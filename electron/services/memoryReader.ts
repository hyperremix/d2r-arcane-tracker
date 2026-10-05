import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { ffi, Kernel32 } from 'win32-api';
import { findKnownBuild, PE_HEADER_READ_SIZE, parsePeIdentity } from '../config/d2rBuilds';
import { D2RGameState, OFFSET_ADJUSTMENTS } from '../config/d2rPatterns';
import { createServiceLogger } from '../utils/serviceLogger';
import type { EventBus } from './EventBus';
import type { ProcessMonitor } from './processMonitor';
import { resolveUiOffset } from './uiOffsetResolver';

const log = createServiceLogger('MemoryReader');

const execAsync = promisify(exec);

/**
 * Checks if a memory region is readable.
 * @param state - Memory state from MEMORY_BASIC_INFORMATION
 * @param protect - Memory protection flags from MEMORY_BASIC_INFORMATION
 * @returns True if the region is readable, false otherwise
 */
function isMemoryRegionReadable(state: number, protect: number): boolean {
  const isCommitted = state === MEM_COMMIT;
  const isReadable =
    (protect & PAGE_READONLY) !== 0 ||
    (protect & PAGE_READWRITE) !== 0 ||
    (protect & PAGE_WRITECOPY) !== 0 ||
    (protect & PAGE_EXECUTE_READ) !== 0 ||
    (protect & PAGE_EXECUTE_READWRITE) !== 0 ||
    (protect & PAGE_EXECUTE_WRITECOPY) !== 0;
  const hasGuard = (protect & PAGE_GUARD) !== 0;

  return isCommitted && isReadable && !hasGuard;
}

/**
 * Queries a memory region using VirtualQueryEx.
 * @param k32 - Extended kernel32 API
 * @param handle - Process handle
 * @param address - Address to query
 * @returns Object with region info or null if query failed
 */
function queryMemoryRegion(
  k32: ExtendedKernel32,
  handle: number,
  address: number,
): { regionSize: number; state: number; protect: number } | null {
  // MEMORY_BASIC_INFORMATION structure (x64):
  // BaseAddress       0-7   (PVOID - 8 bytes)
  // AllocationBase    8-15  (PVOID - 8 bytes)
  // AllocationProtect 16-19 (DWORD - 4 bytes)
  // <padding>         20-23 (4 bytes alignment)
  // RegionSize        24-31 (SIZE_T - 8 bytes)
  // State             32-35 (DWORD - 4 bytes)
  // Protect           36-39 (DWORD - 4 bytes)
  // Type              40-43 (DWORD - 4 bytes)
  const mbiBuffer = Buffer.alloc(48);
  const bytesReturned = k32.VirtualQueryEx(handle, address, mbiBuffer, 48);

  // Need at least 40 bytes to read Protect at offset 36 (UInt32 = 4 bytes)
  if (bytesReturned < 40) {
    return null;
  }

  return {
    regionSize: Number(mbiBuffer.readBigUInt64LE(24)), // RegionSize at offset 24
    state: mbiBuffer.readUInt32LE(32), // State at offset 32
    protect: mbiBuffer.readUInt32LE(36), // Protect at offset 36
  };
}

/**
 * Windows API constants for process access.
 */
const PROCESS_VM_READ = 0x0010;
const PROCESS_QUERY_INFORMATION = 0x0400;

// Memory protection constants
const PAGE_READONLY = 0x02;
const PAGE_READWRITE = 0x04;
const PAGE_WRITECOPY = 0x08;
const PAGE_EXECUTE_READ = 0x20;
const PAGE_EXECUTE_READWRITE = 0x40;
const PAGE_EXECUTE_WRITECOPY = 0x80;
const PAGE_GUARD = 0x100;

// Memory state constants
const MEM_COMMIT = 0x1000;

// Module image reading: size of a normal read, and the page size used when a larger read fails
const IMAGE_READ_CHUNK_SIZE = 256 * 1024;
const PAGE_SIZE = 4096;
// Used when the module size cannot be determined
const FALLBACK_MODULE_IMAGE_SIZE = 100 * 1024 * 1024;

// Offset calculation can fail while D2R is still starting up, so it is retried
const OFFSET_RETRY_INTERVAL_MS = 5000;
const OFFSET_MAX_ATTEMPTS = 120;

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
  VirtualQueryEx: (
    hProcess: number,
    lpAddress: number,
    lpBuffer: Buffer,
    dwLength: number,
  ) => number; // Returns number of bytes written to buffer
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
      // Note: On x64, HANDLE and pointers are 64-bit, so we use int64
      const kernel32Lib = ffi.load('kernel32.dll');
      const CloseHandleFn = kernel32Lib.func('CloseHandle', 'bool', ['int64']);
      const ReadProcessMemoryFn = kernel32Lib.func('ReadProcessMemory', 'bool', [
        'int64', // hProcess (HANDLE)
        'int64', // lpBaseAddress (LPCVOID)
        'void*', // lpBuffer
        'uint64', // nSize (SIZE_T)
        'void*', // lpNumberOfBytesRead
      ]);
      const VirtualQueryExFn = kernel32Lib.func('VirtualQueryEx', 'uint64', [
        'int64', // hProcess (HANDLE)
        'int64', // lpAddress (LPCVOID)
        'void*', // lpBuffer (PMEMORY_BASIC_INFORMATION)
        'uint64', // dwLength (SIZE_T)
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
        VirtualQueryEx: (
          hProcess: number,
          lpAddress: number,
          lpBuffer: Buffer,
          dwLength: number,
        ) => {
          return VirtualQueryExFn(hProcess, lpAddress, lpBuffer, dwLength);
        },
      } as ExtendedKernel32;

      log.info('getKernel32', 'Loaded kernel32.dll bindings with extended functions');
    } catch (error) {
      log.error('getKernel32', error);
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
   * Gets the base address and image size of a module in the process.
   * @param processId - Process ID
   * @param moduleName - Name of the module (e.g., 'D2R.exe')
   * @returns Base address (hex string) and image size in bytes, or null
   */
  getModuleInfo(processId: number, moduleName: string): Promise<ModuleInfo | null>;

  /**
   * Reads memory from a process at the given address.
   * @param handle - Process handle
   * @param address - Memory address to read (as number)
   * @param size - Number of bytes to read
   * @param quiet - Suppress failure logging (for expected failures such as unreadable pages)
   * @returns Buffer with read data or null on failure
   */
  readMemory(
    handle: number,
    address: number,
    size: number,
    quiet?: boolean,
  ): Promise<Buffer | null>;

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

  /**
   * Reads the module image for pattern scanning.
   * The returned buffer is position-preserving (buffer index === RVA): pages that cannot be read
   * are left zero-filled instead of being skipped, so offsets found in the buffer stay valid.
   * @param handle - Process handle
   * @param baseAddress - Module base address (as hex string)
   * @param size - Size of the module image in bytes
   * @returns Buffer with the module image or null on failure
   */
  readModuleImage(handle: number, baseAddress: string, size: number): Promise<Buffer | null>;
}

/**
 * Base address and image size of a loaded module.
 */
interface ModuleInfo {
  /** Base address as a hex string (no 0x prefix) */
  baseAddress: string;
  /** Size of the module image in bytes (undefined if it could not be determined) */
  size: number | undefined;
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
      log.warn('openProcess', 'openProcess only works on Windows');
      return null;
    }

    const k32 = getKernel32();
    if (!k32) {
      log.error('readMemory', 'kernel32.dll not available');
      return null;
    }

    try {
      // Check if process exists first
      const { stdout } = await execAsync(`tasklist /FI "PID eq ${processId}" /FO CSV /NH`);
      if (!stdout || stdout.trim() === '') {
        log.warn('openProcess', `Process ${processId} not found`);
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
        log.error(
          'openProcess',
          `OpenProcess failed for PID ${processId}, error code: ${errorCode}`,
        );
        return null;
      }

      // Store handle value
      this.handles.set(processId, handleValue);

      log.info(
        'openProcess',
        `Opened process handle 0x${handleValue.toString(16)} for PID ${processId}`,
      );
      return handleValue;
    } catch (error) {
      log.error('openProcess', error);
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
          log.error(
            'closeHandle',
            `CloseHandle failed for handle 0x${handle.toString(16)}, error code: ${errorCode}`,
          );
        } else {
          log.info('closeHandle', `Closed handle 0x${handle.toString(16)}`);
        }
      }
    } catch (error) {
      log.error('closeHandle', error);
    }
  }

  /**
   * Gets the base address and image size of a module.
   * Uses PowerShell, which is simpler than EnumProcessModules and works reliably.
   * @param processId - Process ID
   * @param moduleName - Name of the module
   * @returns Module base address and image size, or null
   */
  async getModuleInfo(processId: number, moduleName: string): Promise<ModuleInfo | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    try {
      const psScript = `
        $process = Get-Process -Id ${processId} -ErrorAction SilentlyContinue
        if ($process) {
          $modules = $process.Modules
          $module = $modules | Where-Object { $_.ModuleName -eq '${moduleName}' }
          if ($module) {
            Write-Output ($module.BaseAddress.ToString('X') + ',' + $module.ModuleMemorySize)
          }
        }
      `;

      const { stdout } = await execAsync(`powershell -Command "${psScript.replace(/\n/g, '; ')}"`);

      const output = stdout?.trim();
      if (!output) {
        return null;
      }

      const [baseAddress, sizeText] = output.split(',');
      const size = Number.parseInt(sizeText ?? '', 10);
      log.info(
        'getModuleInfo',
        `Found ${moduleName}: base address 0x${baseAddress}, image size ${sizeText ?? 'unknown'}`,
      );
      return {
        baseAddress,
        size: Number.isFinite(size) && size > 0 ? size : undefined,
      };
    } catch (error) {
      log.error('getModuleInfo', error);
      return null;
    }
  }

  /**
   * Reads memory from a process using Windows API ReadProcessMemory.
   * @param handle - Process handle (as number)
   * @param address - Memory address to read
   * @param size - Number of bytes to read
   * @param quiet - Suppress failure logging (for expected failures such as unreadable pages)
   * @returns Buffer with read data or null on failure
   */
  async readMemory(
    handle: number,
    address: number,
    size: number,
    quiet = false,
  ): Promise<Buffer | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    const k32 = getKernel32();
    if (!k32) {
      log.error('readMemory', 'kernel32.dll not available');
      return null;
    }

    try {
      // Verify handle exists in our map
      const handleValue = Array.from(this.handles.values()).find((h) => h === handle);
      if (!handleValue || handleValue === 0 || handleValue === -1) {
        log.error('readMemory', `Invalid handle: 0x${handle.toString(16)}`);
        return null;
      }

      // Allocate buffer for reading
      const buffer = Buffer.alloc(size);
      const bytesRead = Buffer.alloc(8); // SIZE_T is 64-bit on x64; a smaller buffer would be overrun

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
        if (!quiet) {
          const errorCode = k32.GetLastError();
          log.error(
            'readMemory',
            `ReadProcessMemory failed at 0x${address.toString(16)}, error code: ${errorCode}`,
          );
        }
        return null;
      }

      // Get actual bytes read
      const bytesReadCount = Number(bytesRead.readBigUInt64LE(0));
      if (bytesReadCount === 0) {
        if (!quiet) {
          log.warn('readMemory', `No bytes read from address 0x${address.toString(16)}`);
        }
        return null;
      }

      // Return buffer with actual data read
      return buffer.subarray(0, bytesReadCount);
    } catch (error) {
      log.error('readMemory', error);
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

  /**
   * Reads the module image for pattern scanning.
   * Uses VirtualQueryEx to find readable regions and copies them to their RVA in the result, so
   * unreadable regions leave zero-filled gaps instead of shifting everything after them.
   * Reads that fail are retried page by page so one bad page does not discard its neighbours.
   * @param handle - Process handle
   * @param baseAddress - Module base address (as hex string)
   * @param size - Size of the module image in bytes
   * @returns Buffer where index === RVA, or null if nothing could be read
   */
  async readModuleImage(handle: number, baseAddress: string, size: number): Promise<Buffer | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    const k32 = getKernel32();
    if (!k32) {
      return null;
    }

    try {
      const baseAddr = Number.parseInt(baseAddress, 16);
      if (Number.isNaN(baseAddr)) {
        log.error('readModuleImage', 'Invalid base address for memory reading');
        return null;
      }

      const image = Buffer.alloc(size);
      let totalRead = 0;
      let rva = 0;

      while (rva < size) {
        const regionInfo = queryMemoryRegion(k32, handle, baseAddr + rva);
        if (!regionInfo || regionInfo.regionSize <= 0) {
          // Failed to query memory, stop scanning
          break;
        }

        const regionEnd = Math.min(rva + regionInfo.regionSize, size);

        if (isMemoryRegionReadable(regionInfo.state, regionInfo.protect)) {
          totalRead += await this.copyRegionIntoImage(handle, baseAddr, image, rva, regionEnd);
        }

        rva = regionEnd;
      }

      if (totalRead === 0) {
        log.error('readModuleImage', 'No readable memory regions found');
        return null;
      }

      return image;
    } catch (error) {
      log.error('readModuleImage', error);
      return null;
    }
  }

  /**
   * Copies the bytes of [startRva, endRva) into the image buffer at their RVA.
   * Falls back to page-sized reads for chunks that fail as a whole.
   * @returns Number of bytes successfully copied
   */
  private async copyRegionIntoImage(
    handle: number,
    baseAddr: number,
    image: Buffer,
    startRva: number,
    endRva: number,
  ): Promise<number> {
    let copied = 0;

    for (let chunkStart = startRva; chunkStart < endRva; chunkStart += IMAGE_READ_CHUNK_SIZE) {
      const chunkEnd = Math.min(chunkStart + IMAGE_READ_CHUNK_SIZE, endRva);
      const chunk = await this.readMemory(
        handle,
        baseAddr + chunkStart,
        chunkEnd - chunkStart,
        true,
      );

      if (chunk && chunk.length > 0) {
        chunk.copy(image, chunkStart);
        copied += chunk.length;
        continue;
      }

      for (let pageStart = chunkStart; pageStart < chunkEnd; pageStart += PAGE_SIZE) {
        const pageEnd = Math.min(pageStart + PAGE_SIZE, chunkEnd);
        const page = await this.readMemory(handle, baseAddr + pageStart, pageEnd - pageStart, true);
        if (page && page.length > 0) {
          page.copy(image, pageStart);
          copied += page.length;
        }
      }
    }

    return copied;
  }
}

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
  private eventUnsubscribers: Array<() => void> = [];
  private offsetRetryTimeout: NodeJS.Timeout | null = null;

  constructor(
    private eventBus: EventBus,
    _processMonitor: ProcessMonitor, // Reserved for future use
  ) {
    this.memoryReader = new WindowsMemoryReaderImpl();
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
   * KNOWN_D2R_BUILDS (see docs/MEMORY_OFFSETS.md).
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
   * Reads the in-game state from memory.
   * Wrapper around readGameState() for backward compatibility.
   * @returns True if in game (1), false if in lobby (0), null on error
   */
  async isInGame(): Promise<boolean | null> {
    const state = await this.readGameState();
    if (state === null) {
      return null;
    }
    return state === D2RGameState.InGame;
  }

  /**
   * Dumps process memory to a file for manual pattern analysis.
   * This is useful when the current pattern is not found and you need to
   * manually search for alternative patterns in the D2R.exe binary.
   * @param filePath - Path to save the memory dump
   * @returns True if dump was successful, false otherwise
   */
  async dumpMemoryForAnalysis(filePath: string): Promise<boolean> {
    if (!this.processHandle || !this.addresses.baseAddress) {
      log.error('dumpMemoryForAnalysis', 'Cannot dump memory: no process handle or base address');
      return false;
    }

    try {
      const memory = await this.memoryReader.readModuleImage(
        this.processHandle,
        this.addresses.baseAddress,
        this.addresses.moduleSize,
      );

      if (!memory) {
        log.error('dumpMemoryForAnalysis', 'Failed to read process memory for dump');
        return false;
      }

      await writeFile(filePath, memory);
      log.info(
        'dumpMemoryForAnalysis',
        `Dumped ${memory.length} bytes (${(memory.length / 1024 / 1024).toFixed(1)}MB) to ${filePath}`,
      );
      return true;
    } catch (error) {
      log.error('dumpMemoryForAnalysis', error);
      return false;
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
