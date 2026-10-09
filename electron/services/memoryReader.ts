import { findKnownBuild, PE_HEADER_READ_SIZE, parsePeIdentity } from '../config/d2rBuilds';
import { D2RGameState, OFFSET_ADJUSTMENTS } from '../config/d2rPatterns';
import { createServiceLogger } from '../utils/serviceLogger';
import type { EventBus } from './EventBus';
import { resolveUiOffset } from './uiOffsetResolver';
import type { WindowsMemoryReader } from './win32/processMemory';

const log = createServiceLogger('MemoryReader');

// Used when the module size cannot be determined
const FALLBACK_MODULE_IMAGE_SIZE = 100 * 1024 * 1024;

// Offset calculation can fail while D2R is still starting up, so it is retried
const OFFSET_RETRY_INTERVAL_MS = 5000;
const OFFSET_MAX_ATTEMPTS = 120;

/**
 * Memory addresses and offsets for D2R game state detection.
 * Uses UI offset for simple byte read game state detection.
 *
 * From d2go game_reader.go line 327:
 * IsIngame() reads 1 byte at: moduleBase + UI - 0xA
 * Returns: 1 = in-game, 0 = lobby
 */
interface D2RMemoryAddresses {
  /**
   * Base address of D2R.exe module
   * This will be determined dynamically by finding the module base address
   */
  baseAddress: string | null;

  /**
   * Size of the D2R.exe module image in bytes (bounds the pattern scan)
   */
  moduleSize: number;

  /**
   * RVA of the in-game flag byte (0 = lobby, 1 = in game).
   * Taken from the known-builds table, or derived from the UI signature for unknown builds.
   */
  inGameFlagOffset: number;
}

/**
 * Service for reading D2R game state from process memory.
 * Detects when player enters/exits games by reading memory addresses.
 *
 * See docs/MEMORY_READING.md for how the in-game flag offset is resolved.
 */
export class MemoryReader {
  private processHandle: number | null = null;
  private processId: number | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private lastGameState: D2RGameState | null = null; // Track previous state value for transitions
  private memoryReader: WindowsMemoryReader;
  private addresses: D2RMemoryAddresses;
  private pollingIntervalMs = 500; // Default 500ms polling interval
  private offsetsValid = false; // Track if offsets are valid (not placeholders)
  private eventUnsubscribers: Array<() => void> = [];
  private offsetRetryTimeout: NodeJS.Timeout | null = null;

  /**
   * @param eventBus - Event bus that announces D2R starts/stops and receives game enter/exit events
   * @param memoryReader - Win32 process memory access (see ./win32/processMemory)
   */
  constructor(
    private eventBus: EventBus,
    memoryReader: WindowsMemoryReader,
  ) {
    this.memoryReader = memoryReader;
    // Initialize with placeholder - resolved once D2R is running
    this.addresses = {
      baseAddress: null,
      moduleSize: FALLBACK_MODULE_IMAGE_SIZE,
      inGameFlagOffset: 0x0,
    };

    // Listen for process start/stop events
    this.eventUnsubscribers.push(
      this.eventBus.on('d2r-started', (payload) => {
        this.handleProcessStarted(payload.processId);
      }),
    );

    this.eventUnsubscribers.push(
      this.eventBus.on('d2r-stopped', () => {
        this.handleProcessStopped();
      }),
    );
  }

  /**
   * Updates polling interval from settings.
   */
  updatePollingInterval(intervalMs: number): void {
    this.pollingIntervalMs = Math.max(100, Math.min(5000, intervalMs)); // Clamp between 100ms and 5s

    if (this.isPolling) {
      // Restart polling with new interval
      this.stopPolling();
      this.startPolling();
    }
  }

  /**
   * Starts polling memory for game state changes.
   */
  startPolling(): void {
    if (this.isPolling) {
      return;
    }

    if (process.platform !== 'win32') {
      return;
    }

    if (!this.processId || !this.processHandle) {
      return;
    }

    this.isPolling = true;
    log.info(
      'startPolling',
      `Memory polling started (${this.pollingIntervalMs}ms interval, offsets valid: ${this.offsetsValid})`,
    );

    // Poll immediately
    this.pollMemory();

    // Then poll periodically
    this.pollingInterval = setInterval(() => {
      this.pollMemory();
    }, this.pollingIntervalMs);
  }

  /**
   * Stops polling memory.
   */
  stopPolling(): void {
    if (!this.isPolling) {
      return;
    }

    this.isPolling = false;

    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }

    log.info('stopPolling', 'Stopped memory polling');
  }

  /**
   * Handles D2R process started event.
   * @private
   */
  private async handleProcessStarted(processId: number): Promise<void> {
    this.cancelOffsetRetry();
    this.processId = processId;

    // Try to open process handle
    const handle = await this.memoryReader.openProcess(processId);
    if (handle) {
      this.processHandle = handle;
      log.info('handleProcessStarted', `Process handle opened for PID ${processId}`);

      await this.initializeWithRetry(processId, 1);
    } else {
      log.error('handleProcessStarted', `Failed to open process handle for PID ${processId}`);
      this.processHandle = null;
    }
  }

  /**
   * Initializes memory offsets, retrying until they resolve or the process goes away.
   * D2R is usually still starting up when the process is detected, and a scan can also fail on a
   * transient read error, so a single attempt is not enough.
   * @private
   */
  private async initializeWithRetry(processId: number, attempt: number): Promise<void> {
    if (this.processId !== processId || !this.processHandle) {
      return;
    }

    await this.initializeMemoryAddresses();

    // The process may have stopped while the scan was running
    if (this.processId !== processId || !this.processHandle) {
      return;
    }

    if (this.offsetsValid) {
      log.info('initializeWithRetry', `Memory offsets resolved on attempt ${attempt}`);
      // RunTrackerService may have already tried to start polling earlier (when there was no
      // handle), so we need to start it here now that we're ready
      this.startPolling();
      return;
    }

    if (attempt >= OFFSET_MAX_ATTEMPTS) {
      log.error(
        'initializeWithRetry',
        `Giving up on memory offsets after ${attempt} attempts — memory polling disabled`,
      );
      return;
    }

    log.warn(
      'initializeWithRetry',
      `Invalid offsets (attempt ${attempt}) - retrying in ${OFFSET_RETRY_INTERVAL_MS}ms`,
    );
    this.offsetRetryTimeout = setTimeout(() => {
      this.offsetRetryTimeout = null;
      void this.initializeWithRetry(processId, attempt + 1);
    }, OFFSET_RETRY_INTERVAL_MS);
  }

  /**
   * Cancels a pending offset retry.
   * @private
   */
  private cancelOffsetRetry(): void {
    if (this.offsetRetryTimeout) {
      clearTimeout(this.offsetRetryTimeout);
      this.offsetRetryTimeout = null;
    }
  }

  /**
   * Handles D2R process stopped event.
   * @private
   */
  private async handleProcessStopped(): Promise<void> {
    this.cancelOffsetRetry();
    this.stopPolling();

    if (this.processHandle) {
      await this.memoryReader.closeHandle(this.processHandle);
      this.processHandle = null;
    }

    this.processId = null;
    this.lastGameState = null;
    this.offsetsValid = false;
    this.addresses.baseAddress = null;
  }

  /**
   * Initializes memory addresses by finding the base address and resolving the in-game flag offset.
   * @private
   */
  private async initializeMemoryAddresses(): Promise<void> {
    if (!this.processId || !this.processHandle) {
      return;
    }

    try {
      // Get D2R.exe module base address (P_0) and image size
      const moduleInfo = await this.memoryReader.getModuleInfo(this.processId, 'D2R.exe');
      if (!moduleInfo) {
        log.warn('initializeMemoryAddresses', 'Could not find D2R.exe base address');
        return;
      }

      this.addresses.baseAddress = moduleInfo.baseAddress;
      this.addresses.moduleSize = moduleInfo.size ?? FALLBACK_MODULE_IMAGE_SIZE;
      log.info(
        'initializeMemoryAddresses',
        `Found D2R.exe base address: 0x${moduleInfo.baseAddress} (image size: ${this.addresses.moduleSize} bytes)`,
      );

      const success = await this.resolveInGameFlagOffset();
      if (!success) {
        log.error(
          'initializeMemoryAddresses',
          'Failed to resolve the in-game flag offset — memory reading disabled',
        );
        this.offsetsValid = false;
        return;
      }

      this.offsetsValid = true;
      log.info(
        'initializeMemoryAddresses',
        `In-game flag offset: 0x${this.addresses.inGameFlagOffset.toString(16)}`,
      );
    } catch (error) {
      log.error('initializeMemoryAddresses', error);
      this.offsetsValid = false;
    }
  }

  /**
   * Resolves the in-game flag offset.
   *
   * Known builds (identified from the PE header) use a verified offset directly. The header is
   * always readable, unlike the code a signature scan needs, a large part of which is
   * PAGE_NOACCESS. If a known build's flag byte is not 0/1 yet, this fails so the caller retries. Unknown builds fall back to the d2go UI signature, which is unverified: it no
   * longer resolves to the in-game flag in current builds, so a new build needs an entry in
   * KNOWN_D2R_BUILDS (see docs/MEMORY_READING.md).
   *
   * @returns True if an offset was resolved, false otherwise
   * @private
   */
  private async resolveInGameFlagOffset(): Promise<boolean> {
    if (!this.processHandle || !this.addresses.baseAddress) {
      return false;
    }

    const baseAddress = Number.parseInt(this.addresses.baseAddress, 16);
    const header = await this.memoryReader.readMemory(
      this.processHandle,
      baseAddress,
      PE_HEADER_READ_SIZE,
      true,
    );
    const identity = header ? parsePeIdentity(header) : undefined;

    if (identity) {
      const knownBuild = findKnownBuild(identity);
      if (knownBuild) {
        const flag = await this.memoryReader.readMemory(
          this.processHandle,
          baseAddress + knownBuild.inGameFlagRva,
          1,
        );
        if (flag && (flag[0] === D2RGameState.Lobby || flag[0] === D2RGameState.InGame)) {
          this.addresses.inGameFlagOffset = knownBuild.inGameFlagRva;
          log.info(
            'resolveInGameFlagOffset',
            `Known D2R build ${knownBuild.fileVersion} - using verified in-game flag offset`,
          );
          return true;
        }
        // Usually D2R is still starting; retry the verified offset rather than the unverified scan
        log.warn(
          'resolveInGameFlagOffset',
          `Known D2R build ${knownBuild.fileVersion} but the flag byte is not readable as 0/1 yet (got ${flag?.[0]}); will retry`,
        );
        return false;
      } else {
        log.warn(
          'resolveInGameFlagOffset',
          `Unknown D2R build (PE timestamp ${identity.timeDateStamp}, image size ${identity.sizeOfImage}). ` +
            'Falling back to the unverified signature scan; run detection may not work until this build is added to KNOWN_D2R_BUILDS',
        );
      }
    } else {
      log.warn('resolveInGameFlagOffset', 'Could not read the D2R.exe PE header');
    }

    return this.scanForInGameFlag();
  }

  /**
   * Finds the in-game flag using the d2go UI signature (legacy; unverified on current builds).
   *
   * From d2go offset.go lines 41-44:
   * ```go
   * pattern = process.FindPattern(memory, "\x40\x84\xed\x0f\x94\x05", "xxxxxx")
   * uiOffset := process.ReadUInt(pattern+6, Uint32)
   * uiOffsetPtr := (pattern - process.moduleBaseAddressPtr) + 10 + uintptr(uiOffset)
   * ```
   * and the flag is at `UI - 0xA`.
   *
   * @returns True if a candidate was found, false otherwise
   * @private
   */
  private async scanForInGameFlag(): Promise<boolean> {
    if (!this.processHandle || !this.addresses.baseAddress) {
      return false;
    }

    const handle = this.processHandle;
    const baseAddress = Number.parseInt(this.addresses.baseAddress, 16);

    try {
      // Read the module image for pattern scanning (buffer index === RVA)
      const image = await this.memoryReader.readModuleImage(
        handle,
        this.addresses.baseAddress,
        this.addresses.moduleSize,
      );

      if (!image) {
        log.error('scanForInGameFlag', 'Failed to read process memory');
        return false;
      }

      // Find the UI pattern and resolve the UI offset from it (see resolveUiOffset)
      // Candidate flags are read live: unreadable pages are zero-filled in the image
      const uiOffset = await resolveUiOffset(image, async (stateRva) => {
        const flag = await this.memoryReader.readMemory(handle, baseAddress + stateRva, 1, true);
        return flag?.[0];
      });
      if (uiOffset === undefined) {
        log.error(
          'scanForInGameFlag',
          `UI pattern not found or invalid in ${image.length} bytes of module image`,
        );
        return false;
      }

      this.addresses.inGameFlagOffset = uiOffset - OFFSET_ADJUSTMENTS.UI_STATE_ADJUSTMENT;

      return true;
    } catch (error) {
      log.error('scanForInGameFlag', error);
      return false;
    }
  }

  /**
   * Polls memory for game state changes and emits events.
   * Detects state transitions: 0 → 1 (Run Started), 1 → 0 (Run Ended)
   * @private
   */
  private async pollMemory(): Promise<void> {
    if (!this.processHandle || !this.processId || !this.offsetsValid) {
      return;
    }

    try {
      const currentState = await this.readGameState();

      if (currentState === null) {
        // Failed to read memory, might be due to permissions or process crash
        return;
      }

      // Detect state transitions
      const previousState = this.lastGameState;

      if (currentState === D2RGameState.InGame && previousState !== D2RGameState.InGame) {
        // Transition: Lobby → InGame (Run Started)
        log.info('pollMemory', 'Game entered (state: 0 → 1)');
        this.eventBus.emit('game-entered', {});
      } else if (currentState === D2RGameState.Lobby && previousState === D2RGameState.InGame) {
        // Transition: InGame → Lobby (Run Ended)
        log.info('pollMemory', 'Game exited (state: 1 → 0)');
        this.eventBus.emit('game-exited', {});
      }

      this.lastGameState = currentState;
    } catch (error) {
      log.error('pollMemory', error);
    }
  }

  /**
   * Reads the game state from memory (one byte at the in-game flag offset).
   * Equivalent to d2go's IsIngame(), which reads `moduleBase + UI - 0xA`.
   *
   * @returns Game state value (0 = Lobby, 1 = InGame) or null on error
   */
  async readGameState(): Promise<D2RGameState | null> {
    if (!this.processHandle || !this.addresses.baseAddress || !this.offsetsValid) {
      return null;
    }

    try {
      const baseAddress = Number.parseInt(this.addresses.baseAddress, 16);
      if (Number.isNaN(baseAddress)) {
        log.error('readGameState', 'Invalid base address');
        return null;
      }

      const stateAddress = baseAddress + this.addresses.inGameFlagOffset;

      // Read 1 byte at the state address
      const buffer = await this.memoryReader.readMemory(this.processHandle, stateAddress, 1);
      if (!buffer || buffer.length === 0) {
        return null;
      }

      const stateValue = buffer[0];

      // Map state value: 1 = in-game, 0 = lobby
      if (stateValue === 1) {
        return D2RGameState.InGame;
      }
      if (stateValue === 0) {
        return D2RGameState.Lobby;
      }

      // Unknown state value - log for debugging
      log.warn('readGameState', `Unknown game state value: ${stateValue}`);
      return D2RGameState.Lobby; // Default to Lobby for safety
    } catch (error) {
      log.error('readGameState', error);
      return null;
    }
  }

  /**
   * Returns whether memory reading offsets are valid.
   */
  isOffsetsValid(): boolean {
    return this.offsetsValid;
  }

  /**
   * Cleans up resources and stops polling.
   */
  async shutdown(): Promise<void> {
    // Unsubscribe EventBus listeners
    for (const unsub of this.eventUnsubscribers) {
      unsub();
    }
    this.eventUnsubscribers.length = 0;

    this.cancelOffsetRetry();
    this.stopPolling();

    if (this.processHandle) {
      await this.memoryReader.closeHandle(this.processHandle);
      this.processHandle = null;
    }

    log.info('shutdown', 'Shutdown complete');
  }
}
