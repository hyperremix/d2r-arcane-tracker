import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { ffi, Kernel32 } from 'win32-api';
import { areOffsetsValid, D2RGameState, getOffsetsForVersion } from '../config/d2rOffsets';
import type { EventBus } from './EventBus';
import type { ProcessMonitor } from './processMonitor';

const execAsync = promisify(exec);

/**
 * Detects the version of D2R.exe by reading file version information.
 * @param processId - Process ID of D2R.exe
 * @returns Version string or 'unknown' if detection fails
 */
async function detectD2RVersion(processId: number): Promise<string> {
  if (process.platform !== 'win32') {
    return 'unknown';
  }

  try {
    // Get process executable path
    const { stdout } = await execAsync(
      `wmic process where "ProcessId=${processId}" get ExecutablePath /format:value`,
    );

    const match = stdout.match(/ExecutablePath=(.+)/);
    if (!match || !match[1]) {
      console.warn('[MemoryReader] Could not find D2R.exe path');
      return 'unknown';
    }

    const exePath = match[1].trim();
    if (!exePath.toLowerCase().endsWith('d2r.exe')) {
      console.warn('[MemoryReader] Process executable is not D2R.exe');
      return 'unknown';
    }

    // Read file version using PowerShell
    const psScript = `
      $file = Get-Item '${exePath.replace(/'/g, "''")}'
      $version = $file.VersionInfo
      Write-Output "$($version.FileMajorPart).$($version.FileMinorPart).$($version.FileBuildPart).$($version.FilePrivatePart)"
    `;

    const { stdout: versionOutput } = await execAsync(
      `powershell -Command "${psScript.replace(/\n/g, '; ')}"`,
    );

    if (versionOutput?.trim()) {
      const version = versionOutput.trim();
      console.log(`[MemoryReader] Detected D2R version: ${version}`);
      return version;
    }

    return 'unknown';
  } catch (error) {
    console.error('[MemoryReader] Error detecting D2R version:', error);
    return 'unknown';
  }
}

/**
 * Windows API constants for process access.
 */
const PROCESS_VM_READ = 0x0010;
const PROCESS_QUERY_INFORMATION = 0x0400;

// Additional kernel32 functions not in default win32-api set
interface ExtendedKernel32 extends ReturnType<typeof Kernel32.load> {
  CloseHandle: (hObject: number) => number; // Returns BOOL (0 or 1)
  ReadProcessMemory: (
    hProcess: number,
    lpBaseAddress: number,
    lpBuffer: Buffer,
    nSize: number,
    lpNumberOfBytesRead: Buffer,
  ) => number; // Returns BOOL (0 or 1)
}

let extendedKernel32: ExtendedKernel32 | null = null;

// Lazy initialization of kernel32 bindings (only on Windows)
function getKernel32(): ExtendedKernel32 | null {
  if (process.platform !== 'win32') {
    return null;
  }

  if (!extendedKernel32) {
    try {
      // Load base kernel32 functions
      const baseK32 = Kernel32.load();

      // Load kernel32.dll for additional functions using koffi
      // koffi.load() is used to load DLL and get function pointers
      const kernel32Lib = ffi.load('kernel32.dll');
      const CloseHandleFn = kernel32Lib.func('CloseHandle', 'bool', ['long']);
      const ReadProcessMemoryFn = kernel32Lib.func('ReadProcessMemory', 'bool', [
        'long',
        'long',
        'pointer',
        'ulong',
        'pointer',
      ]);

      // Combine base functions with additional ones
      extendedKernel32 = {
        ...baseK32,
        CloseHandle: (hObject: number) => {
          const result = CloseHandleFn(hObject);
          return result ? 1 : 0;
        },
        ReadProcessMemory: (
          hProcess: number,
          lpBaseAddress: number,
          lpBuffer: Buffer,
          nSize: number,
          lpNumberOfBytesRead: Buffer,
        ) => {
          const result = ReadProcessMemoryFn(
            hProcess,
            lpBaseAddress,
            lpBuffer,
            nSize,
            lpNumberOfBytesRead,
          );
          return result ? 1 : 0;
        },
      } as ExtendedKernel32;

      console.log('[MemoryReader] Loaded kernel32.dll bindings with extended functions');
    } catch (error) {
      console.error('[MemoryReader] Failed to load kernel32.dll:', error);
      return null;
    }
  }

  return extendedKernel32;
}

/**
 * Interface for Windows memory reading operations.
 * Uses Windows API calls through Node.js child_process for Windows-specific operations.
 */
interface WindowsMemoryReader {
  /**
   * Opens a handle to the process with the given PID.
   * @param processId - Process ID to open
   * @returns Handle value if successful, null otherwise
   */
  openProcess(processId: number): Promise<number | null>;

  /**
   * Closes a process handle.
   * @param handle - Handle to close
   */
  closeHandle(handle: number): Promise<void>;

  /**
   * Gets the base address of a module in the process.
   * @param processId - Process ID
   * @param moduleName - Name of the module (e.g., 'D2R.exe')
   * @returns Base address as hex string or null
   */
  getModuleBaseAddress(processId: number, moduleName: string): Promise<string | null>;

  /**
   * Reads memory from a process at the given address.
   * @param handle - Process handle
   * @param address - Memory address to read (as number)
   * @param size - Number of bytes to read
   * @returns Buffer with read data or null on failure
   */
  readMemory(handle: number, address: number, size: number): Promise<Buffer | null>;

  /**
   * Reads a 32-bit integer from memory.
   * @param handle - Process handle
   * @param address - Memory address to read
   * @returns Number value or null on failure
   */
  readInt32(handle: number, address: number): Promise<number | null>;

  /**
   * Reads a string from memory.
   * @param handle - Process handle
   * @param address - Memory address to read
   * @param maxLength - Maximum length of string to read
   * @returns String value or null on failure
   */
  readString(handle: number, address: number, maxLength?: number): Promise<string | null>;

  /**
   * Reads a 64-bit integer (QWORD) from memory.
   * Used for reading pointer values on 64-bit systems.
   * @param handle - Process handle
   * @param address - Memory address to read
   * @returns Number value or null on failure
   */
  readInt64(handle: number, address: number): Promise<number | null>;
}

/**
 * Windows memory reader implementation using win32-api library.
 * Uses actual Windows API calls via FFI bindings for OpenProcess, ReadProcessMemory, etc.
 */
class WindowsMemoryReaderImpl implements WindowsMemoryReader {
  // Store handles as numeric values (pointers)
  // win32-api returns handles as numeric values, not Buffer objects
  private handles: Map<number, number> = new Map(); // PID -> Handle value

  /**
   * Opens a process handle using Windows API OpenProcess.
   * @param processId - Process ID to open
   * @returns Handle pointer (as number) if successful, null otherwise
   */
  async openProcess(processId: number): Promise<number | null> {
    if (process.platform !== 'win32') {
      console.warn('[MemoryReader] openProcess only works on Windows');
      return null;
    }

    const k32 = getKernel32();
    if (!k32) {
      console.error('[MemoryReader] kernel32.dll not available');
      return null;
    }

    try {
      // Check if process exists first
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${processId}" /FO CSV /NH`);
      if (!stdout || stdout.trim() === '') {
        console.warn(`[MemoryReader] Process ${processId} not found`);
        return null;
      }

      // OpenProcess: HANDLE OpenProcess(DWORD dwDesiredAccess, BOOL bInheritHandle, DWORD dwProcessId)
      const desiredAccess = PROCESS_VM_READ | PROCESS_QUERY_INFORMATION;
      const inheritHandle = 0; // FALSE
      const handle = k32.OpenProcess(desiredAccess, inheritHandle, processId);

      // Check if handle is valid (NULL/invalid handle is 0 or -1)
      // win32-api returns HANDLE as number (pointer value)
      const handleValue = typeof handle === 'number' ? handle : Number(handle);
      if (!handleValue || handleValue === 0 || handleValue === -1) {
        const errorCode = k32.GetLastError();
        console.error(
          `[MemoryReader] OpenProcess failed for PID ${processId}, error code: ${errorCode}`,
        );
        return null;
      }

      // Store handle value
      this.handles.set(processId, handleValue);

      console.log(
        `[MemoryReader] Opened process handle 0x${handleValue.toString(16)} for PID ${processId}`,
      );
      return handleValue;
    } catch (error) {
      console.error('[MemoryReader] Error opening process:', error);
      return null;
    }
  }

  /**
   * Closes a process handle using Windows API CloseHandle.
   * @param handle - Handle value (as number) to close
   */
  async closeHandle(handle: number): Promise<void> {
    if (process.platform !== 'win32') {
      return;
    }

    const k32 = getKernel32();
    if (!k32) {
      return;
    }

    try {
      // Find and remove handle from map
      let found = false;
      for (const [pid, handleValue] of this.handles.entries()) {
        if (handleValue === handle) {
          this.handles.delete(pid);
          found = true;
          break;
        }
      }

      if (found) {
        // CloseHandle: BOOL CloseHandle(HANDLE hObject)
        // Returns 0 (false) or 1 (true)
        const success = k32.CloseHandle(handle);
        if (success === 0) {
          const errorCode = k32.GetLastError();
          console.error(
            `[MemoryReader] CloseHandle failed for handle 0x${handle.toString(16)}, error code: ${errorCode}`,
          );
        } else {
          console.log(`[MemoryReader] Closed handle 0x${handle.toString(16)}`);
        }
      }
    } catch (error) {
      console.error('[MemoryReader] Error closing handle:', error);
    }
  }

  /**
   * Gets the base address of a module using Windows API EnumProcessModules.
   * Falls back to PowerShell if EnumProcessModules is not available.
   * @param processId - Process ID
   * @param moduleName - Name of the module
   * @returns Base address as hex string or null
   */
  async getModuleBaseAddress(processId: number, moduleName: string): Promise<string | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    // Note: EnumProcessModules requires more complex handling with HMODULE arrays
    // For now, use PowerShell which is simpler and works reliably
    // TODO: Implement EnumProcessModules properly if needed for better performance

    // Use PowerShell method (works reliably)
    try {
      const psScript = `
        $process = Get-Process -Id ${processId} -ErrorAction SilentlyContinue
        if ($process) {
          $modules = $process.Modules
          $module = $modules | Where-Object { $_.ModuleName -eq '${moduleName}' }
          if ($module) {
            Write-Output $module.BaseAddress.ToString('X')
          }
        }
      `;

      const { stdout } = await execAsync(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`);

      if (stdout?.trim()) {
        const baseAddress = stdout.trim();
        console.log(`[MemoryReader] Found base address for ${moduleName}: 0x${baseAddress}`);
        return baseAddress;
      }

      return null;
    } catch (error) {
      console.error('[MemoryReader] Error getting module base address:', error);
      return null;
    }
  }

  /**
   * Reads memory from a process using Windows API ReadProcessMemory.
   * @param handle - Process handle (as number)
   * @param address - Memory address to read
   * @param size - Number of bytes to read
   * @returns Buffer with read data or null on failure
   */
  async readMemory(handle: number, address: number, size: number): Promise<Buffer | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    const k32 = getKernel32();
    if (!k32) {
      console.error('[MemoryReader] kernel32.dll not available');
      return null;
    }

    try {
      // Verify handle exists in our map
      const handleValue = Array.from(this.handles.values()).find((h) => h === handle);
      if (!handleValue || handleValue === 0 || handleValue === -1) {
        console.error(`[MemoryReader] Invalid handle: 0x${handle.toString(16)}`);
        return null;
      }

      // Allocate buffer for reading
      const buffer = Buffer.alloc(size);
      const bytesRead = Buffer.alloc(4); // SIZE_T for bytes read (32-bit on 32-bit, 64-bit on 64-bit)

      // ReadProcessMemory: BOOL ReadProcessMemory(
      //   HANDLE hProcess,
      //   LPCVOID lpBaseAddress,
      //   LPVOID lpBuffer,
      //   SIZE_T nSize,
      //   SIZE_T* lpNumberOfBytesRead
      // )
      // Returns 0 (false) or 1 (true)
      const success = k32.ReadProcessMemory(handleValue, address, buffer, size, bytesRead);

      if (success === 0) {
        const errorCode = k32.GetLastError();
        console.error(
          `[MemoryReader] ReadProcessMemory failed at 0x${address.toString(16)}, error code: ${errorCode}`,
        );
        return null;
      }

      // Get actual bytes read
      const bytesReadCount = bytesRead.readUInt32LE(0);
      if (bytesReadCount === 0) {
        console.warn(`[MemoryReader] No bytes read from address 0x${address.toString(16)}`);
        return null;
      }

      // Return buffer with actual data read
      return buffer.subarray(0, bytesReadCount);
    } catch (error) {
      console.error('[MemoryReader] Error reading memory:', error);
      return null;
    }
  }

  /**
   * Reads a 32-bit integer from memory.
   * @param handle - Process handle
   * @param address - Memory address to read
   * @returns Number value or null on failure
   */
  async readInt32(handle: number, address: number): Promise<number | null> {
    const buffer = await this.readMemory(handle, address, 4);
    if (!buffer) {
      return null;
    }
    return buffer.readInt32LE(0);
  }

  /**
   * Reads a 64-bit integer (QWORD) from memory.
   * Used for reading pointer values on 64-bit systems (D2R is 64-bit).
   * @param handle - Process handle
   * @param address - Memory address to read
   * @returns Number value or null on failure
   */
  async readInt64(handle: number, address: number): Promise<number | null> {
    const buffer = await this.readMemory(handle, address, 8);
    if (!buffer) {
      return null;
    }
    // Read as BigInt to handle 64-bit values correctly, then convert to number
    // Note: JavaScript numbers are 64-bit floats, but we need to handle 64-bit integers
    // For addresses, we can use readBigUInt64LE and convert
    const bigIntValue = buffer.readBigUInt64LE(0);
    // Convert to number (may lose precision for very large addresses, but should be fine for D2R)
    return Number(bigIntValue);
  }

  /**
   * Reads a string from memory.
   * @param handle - Process handle
   * @param address - Memory address to read
   * @param maxLength - Maximum length of string to read
   * @returns String value or null on failure
   */
  async readString(handle: number, address: number, maxLength = 256): Promise<string | null> {
    const buffer = await this.readMemory(handle, address, maxLength);
    if (!buffer) {
      return null;
    }
    // Find null terminator
    const nullIndex = buffer.indexOf(0);
    if (nullIndex === -1) {
      return buffer.toString('utf8');
    }
    return buffer.subarray(0, nullIndex).toString('utf8');
  }
}

/**
 * Memory addresses and offsets for D2R game state detection.
 * Uses pointer chain architecture: P_0 + P_1 → read QWORD → A_2 + P_2 + P_3 → read DWORD → Game State
 *
 * Architecture:
 * - P_0: Base address of D2R.exe module (detected at runtime)
 * - P_1: Volatile RVA (changes with patches) - version-specific
 * - P_2: Structural offset 1 (stable)
 * - P_3: Structural offset 2 (stable)
 *
 * See docs/EXTRACT_D2GO_ADDRESSES.md for instructions on extracting these values.
 */
interface D2RMemoryAddresses {
  /**
   * Base address of D2R.exe module (P_0)
   * This will be determined dynamically by finding the module base address
   */
  baseAddress: string | null;

  /**
   * P_1: Volatile RVA (Relative Virtual Address)
   * Version-specific offset that changes with D2R patches
   */
  p1: number;

  /**
   * P_2: Structural offset 1 (stable across patches)
   */
  p2: number;

  /**
   * P_3: Structural offset 2 (stable across patches)
   */
  p3: number;

  /**
   * Game version string for validation and offset lookup
   */
  gameVersion: string;

  /**
   * Whether offsets are valid (not placeholder zeros)
   */
  offsetsValid: boolean;

  /**
   * Offset to current game name/ID (for future use)
   * String containing the game name
   */
  gameIdOffset: string;

  /**
   * Offset to character name (for future use)
   * String containing the current character name
   */
  characterNameOffset: string;
}

/**
 * Service for reading D2R game state from process memory.
 * Detects when player enters/exits games by reading memory addresses.
 *
 * Implementation structure based on patterns from d2go repository.
 * Memory addresses need to be extracted from d2go's pkg/memory package.
 *
 * See docs/EXTRACT_D2GO_ADDRESSES.md for instructions.
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

  constructor(
    private eventBus: EventBus,
    _processMonitor: ProcessMonitor, // Reserved for future use
  ) {
    this.memoryReader = new WindowsMemoryReaderImpl();
    // Initialize with placeholder addresses - will be updated when process starts
    this.addresses = {
      baseAddress: null,
      p1: 0x0, // Will be loaded from offset map based on version
      p2: 0x0, // Will be loaded from offset map
      p3: 0x0, // Will be loaded from offset map
      gameVersion: 'unknown',
      offsetsValid: false,
      gameIdOffset: '0x0', // TODO: Extract from d2go's pkg/memory
      characterNameOffset: '0x0', // TODO: Extract from d2go's pkg/memory
    };

    // Listen for process start/stop events
    this.eventBus.on('d2r-started', (payload) => {
      this.handleProcessStarted(payload.processId);
    });

    this.eventBus.on('d2r-stopped', () => {
      this.handleProcessStopped();
    });

    console.log('[MemoryReader] Initialized');
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
      console.log('[MemoryReader] Platform not supported, skipping memory reading');
      return;
    }

    if (!this.processId || !this.processHandle) {
      console.log('[MemoryReader] No process handle available, cannot start polling');
      return;
    }

    this.isPolling = true;
    console.log(`[MemoryReader] Starting memory polling (interval: ${this.pollingIntervalMs}ms)`);

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

    console.log('[MemoryReader] Stopped memory polling');
  }

  /**
   * Handles D2R process started event.
   * @private
   */
  private async handleProcessStarted(processId: number): Promise<void> {
    console.log(`[MemoryReader] D2R process started: PID ${processId}`);
    this.processId = processId;

    // Try to open process handle
    const handle = await this.memoryReader.openProcess(processId);
    if (handle) {
      this.processHandle = handle;
      console.log('[MemoryReader] Process handle opened successfully');

      // Find base address and initialize memory addresses
      await this.initializeMemoryAddresses();

      // Start polling if enabled
      // Note: Will be started by RunTrackerService when memory reading is enabled
    } else {
      console.error('[MemoryReader] Failed to open process handle');
      this.processHandle = null;
    }
  }

  /**
   * Handles D2R process stopped event.
   * @private
   */
  private async handleProcessStopped(): Promise<void> {
    console.log('[MemoryReader] D2R process stopped');

    this.stopPolling();

    if (this.processHandle) {
      await this.memoryReader.closeHandle(this.processHandle);
      this.processHandle = null;
    }

    this.processId = null;
    this.lastGameState = null;
  }

  /**
   * Initializes memory addresses by finding the base address and loading version-specific offsets.
   * Based on pointer chain architecture from ResurrectedTrade and d2go.
   * @private
   */
  private async initializeMemoryAddresses(): Promise<void> {
    if (!this.processId) {
      return;
    }

    try {
      // Get D2R.exe module base address (P_0)
      const baseAddress = await this.memoryReader.getModuleBaseAddress(this.processId, 'D2R.exe');
      if (!baseAddress) {
        console.warn('[MemoryReader] Could not find D2R.exe base address');
        return;
      }

      this.addresses.baseAddress = baseAddress;
      console.log(`[MemoryReader] Found D2R.exe base address: 0x${baseAddress}`);

      // Detect D2R version
      const version = await detectD2RVersion(this.processId);
      this.addresses.gameVersion = version;

      // Lookup offsets for this version
      const offsets = getOffsetsForVersion(version);
      this.addresses.p1 = offsets.p1;
      this.addresses.p2 = offsets.p2;
      this.addresses.p3 = offsets.p3;
      this.addresses.offsetsValid = areOffsetsValid(offsets);
      this.offsetsValid = this.addresses.offsetsValid;

      if (!this.addresses.offsetsValid) {
        console.error(
          `[MemoryReader] Invalid offsets for version ${version}. Memory reading disabled.`,
        );
        console.error(
          '[MemoryReader] Offsets need to be extracted from d2go or ResurrectedTrade repositories.',
        );
        console.error(
          '[MemoryReader] Falling back to save file monitoring. See docs/MEMORY_OFFSETS.md',
        );
        // Disable memory reading - RunTrackerService will handle fallback
        return;
      }

      console.log(
        `[MemoryReader] Loaded offsets for version ${version}: P_1=0x${offsets.p1.toString(16)}, P_2=0x${offsets.p2.toString(16)}, P_3=0x${offsets.p3.toString(16)}`,
      );
    } catch (error) {
      console.error('[MemoryReader] Error initializing memory addresses:', error);
      this.addresses.offsetsValid = false;
      this.offsetsValid = false;
    }
  }

  /**
   * Polls memory for game state changes and emits events.
   * Detects state transitions: 0x00 → 0x02 (Run Started), 0x02 → 0x00 (Run Ended)
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
        const gameId = await this.getGameId();
        const characterName = await this.getCharacterName();

        console.log('[MemoryReader] Game entered detected (0x00 → 0x02)');
        this.eventBus.emit('game-entered', {
          gameId: gameId || undefined,
          characterId: characterName || undefined,
        });
      } else if (currentState === D2RGameState.Lobby && previousState === D2RGameState.InGame) {
        // Transition: InGame → Lobby (Run Ended)
        const characterName = await this.getCharacterName();

        console.log('[MemoryReader] Game exited detected (0x02 → 0x00)');
        this.eventBus.emit('game-exited', {
          characterId: characterName || undefined,
        });
      }

      this.lastGameState = currentState;
    } catch (error) {
      console.error('[MemoryReader] Error polling memory:', error);
    }
  }

  /**
   * Reads the game state from memory using the 3-level pointer chain architecture.
   * Architecture: P_0 + P_1 → read QWORD → A_2 + P_2 + P_3 → read DWORD → Game State
   *
   * @returns Game state value (0x00 = Lobby, 0x02 = InGame) or null on error
   */
  async readGameState(): Promise<D2RGameState | null> {
    if (!this.processHandle || !this.addresses.baseAddress || !this.offsetsValid) {
      return null;
    }

    try {
      // Resolve pointer chain to get final address
      const finalAddress = await this.resolvePointerChain();
      if (finalAddress === 0) {
        return null;
      }

      // Read DWORD (4 bytes) at final address to get game state
      const stateValue = await this.memoryReader.readInt32(this.processHandle, finalAddress);
      if (stateValue === null) {
        return null;
      }

      // Map state value to enum
      if (stateValue === D2RGameState.InGame) {
        return D2RGameState.InGame;
      } else if (stateValue === D2RGameState.Lobby) {
        return D2RGameState.Lobby;
      }

      // Unknown state value - log for debugging
      console.warn(`[MemoryReader] Unknown game state value: 0x${stateValue.toString(16)}`);
      return D2RGameState.Lobby; // Default to Lobby for safety
    } catch (error) {
      console.error('[MemoryReader] Error reading game state:', error);
      return null;
    }
  }

  /**
   * Reads the in-game state from memory.
   * Wrapper around readGameState() for backward compatibility.
   * @returns True if in game (0x02), false if in lobby (0x00), null on error
   */
  async isInGame(): Promise<boolean | null> {
    const state = await this.readGameState();
    if (state === null) {
      return null;
    }
    return state === D2RGameState.InGame;
  }

  /**
   * Gets the current game ID/name from memory.
   * @returns Game ID string or null on error
   */
  async getGameId(): Promise<string | null> {
    if (!this.processHandle || !this.addresses.baseAddress) {
      return null;
    }

    try {
      const address = this.calculateAddress(this.addresses.gameIdOffset);
      if (address === 0) {
        return null;
      }

      return await this.memoryReader.readString(this.processHandle, address, 64);
    } catch (error) {
      console.error('[MemoryReader] Error reading game ID:', error);
      return null;
    }
  }

  /**
   * Gets the current character name from memory.
   * @returns Character name string or null on error
   */
  async getCharacterName(): Promise<string | null> {
    if (!this.processHandle || !this.addresses.baseAddress) {
      return null;
    }

    try {
      const address = this.calculateAddress(this.addresses.characterNameOffset);
      if (address === 0) {
        return null;
      }

      return await this.memoryReader.readString(this.processHandle, address, 32);
    } catch (error) {
      console.error('[MemoryReader] Error reading character name:', error);
      return null;
    }
  }

  /**
   * Resolves the 3-level pointer chain to get the final address for game state reading.
   * Architecture: P_0 + P_1 → read QWORD → A_2 + P_2 + P_3 → final address
   *
   * Steps:
   * 1. Calculate A_1 = P_0 (base address) + P_1 (volatile RVA)
   * 2. Read QWORD (8 bytes) at A_1 to get A_2 (Global Game Context Pointer)
   * 3. NULL check: If A_2 is 0x00, return 0 (Game Ended)
   * 4. Calculate final address = A_2 + P_2 + P_3
   *
   * @returns Final memory address for game state reading, or 0 on error/NULL pointer
   * @private
   */
  private async resolvePointerChain(): Promise<number> {
    if (!this.processHandle || !this.addresses.baseAddress) {
      return 0;
    }

    try {
      // Step 1: Calculate A_1 = P_0 + P_1
      const baseAddress = Number.parseInt(this.addresses.baseAddress, 16);
      if (Number.isNaN(baseAddress)) {
        console.error('[MemoryReader] Invalid base address');
        return 0;
      }

      const a1 = baseAddress + this.addresses.p1;

      // Step 2: Read QWORD (8 bytes) at A_1 to get A_2 (Global Game Context Pointer)
      const a2 = await this.memoryReader.readInt64(this.processHandle, a1);
      if (a2 === null) {
        console.warn('[MemoryReader] Failed to read QWORD at A_1');
        return 0;
      }

      // Step 3: NULL check - if A_2 is 0x00, Game Ended state
      if (a2 === 0x00 || a2 === 0) {
        // Game Context Pointer is NULL - player is not in game
        return 0;
      }

      // Step 4: Calculate final address = A_2 + P_2 + P_3
      const finalAddress = a2 + this.addresses.p2 + this.addresses.p3;

      return finalAddress;
    } catch (error) {
      console.error('[MemoryReader] Error resolving pointer chain:', error);
      return 0;
    }
  }

  /**
   * Calculates full memory address from base address and offset.
   * @private
   */
  private calculateAddress(offset: string): number {
    if (!this.addresses.baseAddress) {
      return 0;
    }

    const base = Number.parseInt(this.addresses.baseAddress, 16);
    const off = Number.parseInt(offset, 16);

    if (Number.isNaN(base) || Number.isNaN(off)) {
      return 0;
    }

    return base + off;
  }

  /**
   * Updates memory addresses from external source (e.g., extracted from d2go).
   * @param addresses - New memory addresses configuration
   */
  updateMemoryAddresses(addresses: Partial<D2RMemoryAddresses>): void {
    this.addresses = { ...this.addresses, ...addresses };
    console.log('[MemoryReader] Memory addresses updated:', addresses);
  }

  /**
   * Cleans up resources and stops polling.
   */
  async shutdown(): Promise<void> {
    this.stopPolling();

    if (this.processHandle) {
      await this.memoryReader.closeHandle(this.processHandle);
      this.processHandle = null;
    }

    console.log('[MemoryReader] Shutdown complete');
  }
}
