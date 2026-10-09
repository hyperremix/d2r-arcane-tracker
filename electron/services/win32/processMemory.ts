// Win32 process memory access through win32-api (koffi FFI bindings to kernel32.dll).
// Windows only: the app imports this module dynamically on Windows, so other platforms never load
// the native bindings.

import { execFile } from 'node:child_process';
import { ffi, Kernel32 } from 'win32-api';
import { createServiceLogger } from '../../utils/serviceLogger';
import type { ExecFileFunction } from '../d2rProcess';

const log = createServiceLogger('MemoryReader');

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
 */
export interface WindowsMemoryReader {
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
export interface ModuleInfo {
  /** Base address as a hex string (no 0x prefix) */
  baseAddress: string;
  /** Size of the module image in bytes (undefined if it could not be determined) */
  size: number | undefined;
}

/**
 * Windows memory reader implementation using win32-api library.
 * Uses actual Windows API calls via FFI bindings for OpenProcess, ReadProcessMemory, etc.
 */
export class WindowsMemoryReaderImpl implements WindowsMemoryReader {
  // Store handles as numeric values (pointers)
  // win32-api returns handles as numeric values, not Buffer objects
  private handles: Map<number, number> = new Map(); // PID -> Handle value

  /**
   * @param execFileImpl - `execFile` override for tests
   */
  constructor(
    private readonly execFileImpl: ExecFileFunction = execFile as unknown as ExecFileFunction,
  ) {}

  /**
   * Runs a PowerShell command without a shell in between.
   * @param command - The PowerShell command
   * @returns The standard output
   * @throws If PowerShell cannot be run or exits with an error
   */
  private runPowerShell(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.execFileImpl(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-Command', command],
        { windowsHide: true },
        (error, stdout) => {
          if (error) {
            reject(error);
            return;
          }
          resolve(String(stdout));
        },
      );
    });
  }

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
      // OpenProcess fails (returns NULL) for a process that does not exist, so no separate check
      // is needed. OpenProcess: HANDLE OpenProcess(DWORD dwDesiredAccess, BOOL bInheritHandle, DWORD dwProcessId)
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
   * Uses PowerShell (run with `execFile`, without a shell), which is simpler than
   * EnumProcessModules and works reliably.
   * @param processId - Process ID
   * @param moduleName - Name of the module
   * @returns Module base address and image size, or null
   */
  async getModuleInfo(processId: number, moduleName: string): Promise<ModuleInfo | null> {
    if (process.platform !== 'win32') {
      return null;
    }

    if (!Number.isInteger(processId) || processId <= 0 || !/^[\w.-]+$/.test(moduleName)) {
      log.warn('getModuleInfo', `Invalid process ID ${processId} or module name ${moduleName}`);
      return null;
    }

    try {
      const psScript = [
        `$process = Get-Process -Id ${processId} -ErrorAction SilentlyContinue`,
        'if ($process) {',
        `$module = $process.Modules | Where-Object { $_.ModuleName -eq '${moduleName}' }`,
        "if ($module) { Write-Output ($module.BaseAddress.ToString('X') + ',' + $module.ModuleMemorySize) }",
        '}',
      ].join('; ');

      const stdout = await this.runPowerShell(psScript);

      const output = stdout.trim();
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
