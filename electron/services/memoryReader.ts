import { exec } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { ffi, Kernel32 } from 'win32-api';
import { D2R_PATTERNS, D2RGameState, OFFSET_ADJUSTMENTS } from '../config/d2rPatterns';
import { createServiceLogger } from '../utils/serviceLogger';
import type { EventBus } from './EventBus';
import { findPatternString, readBytesFromBuffer } from './patternScanner';
import type { ProcessMonitor } from './processMonitor';

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

  /**
   * Reads a large region of process memory for pattern scanning.
   * Reads the .text section (executable code) of the module.
   * @param handle - Process handle
   * @param baseAddress - Module base address (as hex string)
   * @param size - Size of memory region to read (default: 20MB)
   * @returns Buffer with memory contents or null on failure
   */
  readProcessMemory(handle: number, baseAddress: string, size?: number): Promise<Buffer | null>;
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
        log.info('getModuleBaseAddress', `Found base address for ${moduleName}: 0x${baseAddress}`);
        return baseAddress;
      }

      return null;
    } catch (error) {
      log.error('getModuleBaseAddress', error);
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
        log.error(
          'readMemory',
          `ReadProcessMemory failed at 0x${address.toString(16)}, error code: ${errorCode}`,
        );
        return null;
      }

      // Get actual bytes read
      const bytesReadCount = bytesRead.readUInt32LE(0);
      if (bytesReadCount === 0) {
        log.warn('readMemory', `No bytes read from address 0x${address.toString(16)}`);
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
   * Reads a large region of process memory for pattern scanning.
   * Uses VirtualQueryEx to enumerate readable memory regions.
   * @param handle - Process handle
   * @param baseAddress - Module base address (as hex string)
   * @param maxSize - Maximum size to scan (default: 100MB to cover full D2R.exe)
   * @returns Buffer with memory contents or null on failure
   */
  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Memory enumeration requires multiple checks
  async readProcessMemory(
    handle: number,
    baseAddress: string,
    maxSize = 100 * 1024 * 1024,
  ): Promise<Buffer | null> {
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
        log.error('readProcessMemory', 'Invalid base address for memory reading');
        return null;
      }

      const chunks: Buffer[] = [];
      let currentAddress = baseAddr;
      const endAddress = baseAddr + maxSize;
      let totalRead = 0;

      // Enumerate and read committed, readable memory regions
      while (currentAddress < endAddress) {
        const regionInfo = queryMemoryRegion(k32, handle, currentAddress);

        if (!regionInfo) {
          // Failed to query memory, stop scanning
          break;
        }

        // Check if region is committed and readable
        if (isMemoryRegionReadable(regionInfo.state, regionInfo.protect)) {
          // Read this region
          const readSize = Math.min(regionInfo.regionSize, endAddress - currentAddress);
          const chunk = await this.readMemory(handle, currentAddress, readSize);

          if (chunk && chunk.length > 0) {
            chunks.push(chunk);
            totalRead += chunk.length;
          }
        }

        // Move to next region
        currentAddress += regionInfo.regionSize;

        // Safety check: don't scan forever
        if (totalRead > maxSize || chunks.length > 1000) {
          break;
        }
      }

      if (chunks.length === 0) {
        log.error('readProcessMemory', 'No readable memory regions found');
        return null;
      }

      // Concatenate all chunks into single buffer
      const result = Buffer.concat(chunks, totalRead);
      return result;
    } catch (error) {
      log.error('readProcessMemory', error);
      return null;
    }
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
   * UI offset (calculated using pattern matching)
   * Used to read game state byte at: moduleBase + UI - 0xA
   */
  uiOffset: number;
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
    // Initialize with placeholder - UI offset will be calculated using pattern matching
    this.addresses = {
      baseAddress: null,
      uiOffset: 0x0, // Will be calculated using pattern matching
    };

    // Listen for process start/stop events
    this.eventBus.on('d2r-started', (payload) => {
      this.handleProcessStarted(payload.processId);
    });

    this.eventBus.on('d2r-stopped', () => {
      this.handleProcessStopped();
    });
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
    this.processId = processId;

    // Try to open process handle
    const handle = await this.memoryReader.openProcess(processId);
    if (handle) {
      this.processHandle = handle;
      log.info('handleProcessStarted', `Process handle opened for PID ${processId}`);

      // Find base address and initialize memory addresses
      await this.initializeMemoryAddresses();

      // Automatically start polling now that we have a process handle
      // RunTrackerService may have already tried to start polling earlier (when there was no handle)
      // so we need to start it here now that we're ready
      if (this.offsetsValid) {
        this.startPolling();
      } else {
        log.warn('handleProcessStarted', 'Invalid offsets - memory polling disabled');
      }
    } else {
      log.error('handleProcessStarted', `Failed to open process handle for PID ${processId}`);
      this.processHandle = null;
    }
  }

  /**
   * Handles D2R process stopped event.
   * @private
   */
  private async handleProcessStopped(): Promise<void> {
    this.stopPolling();

    if (this.processHandle) {
      await this.memoryReader.closeHandle(this.processHandle);
      this.processHandle = null;
    }

    this.processId = null;
    this.lastGameState = null;
  }

  /**
   * Initializes memory addresses by finding the base address and calculating offsets using pattern matching.
   * Based on d2go's dynamic offset calculation approach.
   * @private
   */
  private async initializeMemoryAddresses(): Promise<void> {
    if (!this.processId || !this.processHandle) {
      return;
    }

    try {
      // Get D2R.exe module base address (P_0)
      const baseAddress = await this.memoryReader.getModuleBaseAddress(this.processId, 'D2R.exe');
      if (!baseAddress) {
        log.warn('initializeMemoryAddresses', 'Could not find D2R.exe base address');
        return;
      }

      this.addresses.baseAddress = baseAddress;
      log.info('initializeMemoryAddresses', `Found D2R.exe base address: 0x${baseAddress}`);

      // Calculate offsets using pattern matching
      const success = await this.calculateOffsets();
      if (!success) {
        log.error(
          'initializeMemoryAddresses',
          'Failed to calculate offsets using pattern matching — memory reading disabled',
        );
        this.offsetsValid = false;
        return;
      }

      this.offsetsValid = true;
      log.info(
        'initializeMemoryAddresses',
        `Successfully calculated UI offset: 0x${this.addresses.uiOffset.toString(16)}`,
      );
    } catch (error) {
      log.error('initializeMemoryAddresses', error);
      this.offsetsValid = false;
    }
  }

  /**
   * Calculates memory offsets dynamically using pattern matching.
   * Ported from d2go's calculateOffsets function.
   *
   * From d2go offset.go lines 41-44:
   * ```go
   * pattern = process.FindPattern(memory, "\x40\x84\xed\x0f\x94\x05", "xxxxxx")
   * uiOffset := process.ReadUInt(pattern+6, Uint32)
   * uiOffsetPtr := (pattern - process.moduleBaseAddressPtr) + 10 + uintptr(uiOffset)
   * ```
   *
   * @returns True if offsets were successfully calculated, false otherwise
   * @private
   */
  private async calculateOffsets(): Promise<boolean> {
    if (!this.processHandle || !this.addresses.baseAddress) {
      return false;
    }

    try {
      // Read process memory for pattern scanning
      const memory = await this.memoryReader.readProcessMemory(
        this.processHandle,
        this.addresses.baseAddress,
      );

      if (!memory) {
        log.error('calculateOffsets', 'Failed to read process memory');
        return false;
      }

      // Find UI pattern
      const pattern = D2R_PATTERNS.UI;
      const patternOffset = findPatternString(memory, pattern.pattern, pattern.mask);

      if (patternOffset === -1) {
        log.error('calculateOffsets', `${pattern.name} pattern not found in memory`);
        return false;
      }

      // Read uint32 value at pattern + 6 (from d2go line 43)
      const bytes = readBytesFromBuffer(
        memory,
        patternOffset + OFFSET_ADJUSTMENTS.UI_READ_OFFSET,
        4,
      );

      if (!bytes) {
        log.error('calculateOffsets', 'Failed to read bytes from pattern offset');
        return false;
      }

      const offsetInt = bytes.readUInt32LE(0);

      // Calculate UI offset (from d2go line 44)
      // uiOffsetPtr = (pattern - moduleBase) + 10 + offsetInt
      // Since our patternOffset is already relative to moduleBase:
      // uiOffsetPtr = patternOffset + 10 + offsetInt
      const uiOffset = patternOffset + OFFSET_ADJUSTMENTS.UI_INSTRUCTION_OFFSET + offsetInt;

      this.addresses.uiOffset = uiOffset;

      return true;
    } catch (error) {
      log.error('calculateOffsets', error);
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
   * Reads the game state from memory using UI offset byte read.
   * From d2go game_reader.go line 327:
   * ```go
   * func (gd *GameReader) IsIngame() bool {
   *     return gd.ReadUInt(gd.Process.moduleBaseAddressPtr+gd.offset.UI-0xA, 1) == 1
   * }
   * ```
   *
   * @returns Game state value (0 = Lobby, 1 = InGame) or null on error
   */
  async readGameState(): Promise<D2RGameState | null> {
    if (!this.processHandle || !this.addresses.baseAddress || !this.offsetsValid) {
      return null;
    }

    try {
      // Calculate address: moduleBase + UI - 0xA
      const baseAddress = Number.parseInt(this.addresses.baseAddress, 16);
      if (Number.isNaN(baseAddress)) {
        log.error('readGameState', 'Invalid base address');
        return null;
      }

      const stateAddress =
        baseAddress + this.addresses.uiOffset - OFFSET_ADJUSTMENTS.UI_STATE_ADJUSTMENT;

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
      const memory = await this.memoryReader.readProcessMemory(
        this.processHandle,
        this.addresses.baseAddress,
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
    this.stopPolling();

    if (this.processHandle) {
      await this.memoryReader.closeHandle(this.processHandle);
      this.processHandle = null;
    }

    log.info('shutdown', 'Shutdown complete');
  }
}
