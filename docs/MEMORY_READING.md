# D2R Memory Reading Implementation Guide

## Overview

This document outlines the approach for implementing memory reading to detect game start/end events in Diablo 2 Resurrected (D2R) for the d2r-arcane-tracker application.

## Research Findings

### MF_run_counter Analysis

According to the [MF_run_counter README](https://github.com/oskros/MF_run_counter), the tool has two automode types:

1. **Advanced Mode**: Uses memory reading of the `_Game.exe_` process for **classic Diablo 2** (patches 1.13c, 1.13d, 1.14b, 1.14c, 1.14d)
   - This is **NOT** for D2R - it targets the original Diablo 2 executable
   - Works with D2SE mod manager

2. **Simple Mode**: Monitors save file "latest change time" 
   - This is what MF_run_counter uses for D2R (mentioned in release notes: "Simple automode for D2R")
   - Does NOT use memory reading for D2R

**Conclusion**: MF_run_counter does NOT currently implement memory reading for D2R. The Advanced mode is only for classic Diablo 2.

### d2go Repository Analysis

**Excellent Discovery!** The [d2go repository](https://github.com/hectorgimenez/d2go) by hectorgimenez provides a **working implementation** of D2R memory reading:

1. **Memory Reader Library**: Contains a `pkg/memory` package specifically for reading D2R game memory
2. **Data Structures**: Provides data structures for game state information
3. **Go Implementation**: Written in Go, demonstrating that D2R memory reading is feasible
4. **Active Project**: Repository is actively maintained with recent commits

**Key Value**: This repository likely contains:
- Actual memory offsets/addresses for D2R
- Data structures showing how game state is stored
- Implementation patterns we can adapt to our TypeScript/Node.js codebase
- Validation that D2R memory reading works

**Next Action**: Examine the `pkg/memory` package source code to extract:
- Memory address offsets for in-game state detection
- Data structure definitions
- Implementation patterns for Windows memory reading
- Any version-specific handling

## D2R Memory Structure Considerations

D2R is a completely different game engine than classic Diablo 2:
- Built on a modern engine (likely Unreal Engine-based)
- Different memory structure and address layout
- Different process name (`D2R.exe` vs `Game.exe`)
- May have anti-cheat protections that classic D2 lacks

## Finding D2R Memory Addresses

### Primary Source: d2go Repository

The [d2go repository](https://github.com/hectorgimenez/d2go) is the **most promising source** for D2R memory addresses:

1. **Examine the Code**:
   - Review `pkg/memory` package implementation
   - Extract memory offsets and data structures
   - Understand how they detect game state changes
   - Note any version-specific handling

2. **Adapt the Implementation**:
   - Translate Go memory reading patterns to Node.js/Windows API
   - Use the same data structures and offsets
   - Implement similar memory reading logic in TypeScript

3. **Reference Implementation**:
   - The repository shows a working example of D2R memory reading
   - Can serve as a reference for our implementation approach

### Alternative Methods (if d2go doesn't provide needed addresses)

Since MF_run_counter doesn't provide D2R memory addresses, we can also determine them through:

### Method 1: Community Research

1. **Diablo 2 Community Forums**:
   - Reddit: r/diablo2, r/diablo2resurrected
   - d2jsp.org forums
   - GitHub discussions for D2R tools

2. **Reverse Engineering Communities**:
   - UnknownCheats.me (may have D2R memory research)
   - GuidedHacking.com
   - Note: Only use for legitimate single-player tools

### Method 2: Memory Scanning Tools

Using tools like Cheat Engine:

1. **Find Base Address**:
   - Attach Cheat Engine to `D2R.exe` process
   - Scan for known values (e.g., character name, level)
   - Find pointer chains to base addresses

2. **Identify Game State Indicators**:
   - Scan for values that change when entering/exiting game
   - Look for boolean flags (0/1) that indicate "in-game" state
   - Monitor memory changes during game transitions

3. **Document Patterns**:
   - Note which addresses change consistently
   - Identify stable offsets from module base
   - Document pointer chains if needed

### Method 3: Process Memory Analysis

Key areas to investigate:

1. **In-Game State Flag**:
   - Boolean indicating if player is in a game vs menu
   - Likely near character/player data structures

2. **Game Session ID/Name**:
   - String containing current game name
   - Used to detect when game changes

3. **Character Name**:
   - Current character name in memory
   - Helps match runs to characters

4. **Map/Area ID**:
   - Current area/map identifier
   - Can help detect game transitions

## Implementation Structure

Our current implementation (`electron/services/memoryReader.ts`) is structured to accept memory addresses once found:

```typescript
interface D2RMemoryAddresses {
  baseAddress: string | null;           // Module base address
  inGameStateOffset: string;            // Offset to in-game flag (e.g., '0x12345678')
  gameIdOffset: string;                 // Offset to game name/ID
  characterNameOffset: string;          // Offset to character name
  gameVersion: string;                  // Game version for validation
}
```

## Memory Reading Pattern (Based on Classic D2 Approach)

Typical pattern for game state detection:

1. **Get Module Base Address**:
   - Enumerate modules in D2R.exe process
   - Find `D2R.exe` module base address
   - Store for offset calculations

2. **Read In-Game State**:
   - Base address + offset = actual memory address
   - Read 4 bytes (32-bit integer) or 1 byte (boolean)
   - Value of 1 = in game, 0 = in menu

3. **Poll Memory**:
   - Check memory at regular intervals (500ms default)
   - Detect state transitions (0→1 = game entered, 1→0 = game exited)
   - Emit events when transitions detected

## Windows API Functions Needed

Our implementation uses these Windows API functions:

```cpp
// Open process handle
HANDLE OpenProcess(
  DWORD dwDesiredAccess,  // PROCESS_VM_READ | PROCESS_QUERY_INFORMATION
  BOOL bInheritHandle,     // FALSE
  DWORD dwProcessId        // D2R.exe PID
);

// Read process memory
BOOL ReadProcessMemory(
  HANDLE hProcess,         // Process handle
  LPCVOID lpBaseAddress,   // Memory address to read
  LPVOID lpBuffer,         // Buffer to receive data
  SIZE_T nSize,            // Number of bytes to read
  SIZE_T* lpNumberOfBytesRead // Actual bytes read
);

// Close handle
BOOL CloseHandle(HANDLE hObject);
```

## Required Permissions

Windows requires appropriate permissions to read process memory:

- **PROCESS_VM_READ** (0x0010): Read memory
- **PROCESS_QUERY_INFORMATION** (0x0400): Query process info

The application may need:
- Administrator privileges (depending on Windows security settings)
- Or be run with appropriate user permissions

## Next Steps

1. **Research Phase**:
   - Search D2R modding communities for memory addresses
   - Check if any existing tools have documented D2R memory structures
   - Look for D2R reverse engineering discussions

2. **Experimental Phase** (if no community data available):
   - Use Cheat Engine to scan D2R memory
   - Identify addresses that change during game transitions
   - Document findings with game version information

3. **Implementation Phase**:
   - Update `WindowsMemoryReaderImpl` in `memoryReader.ts` with actual Windows API calls
   - Implement base address detection
   - Add memory address offsets to `D2RMemoryAddresses` interface
   - Test with actual D2R process

4. **Validation Phase**:
   - Test across different D2R versions
   - Handle version-specific address differences
   - Implement fallback mechanisms

## Version Compatibility

D2R receives regular updates that may change memory layouts:
- Store game version with memory addresses
- Implement version detection
- Provide fallback to save file monitoring if memory reading fails

## Auto Mode Operation

**Important**: Auto mode (automatic run tracking) is **memory reading only**:
- Save file monitoring is **not used** for auto run start/end detection
- Auto mode requires D2R.exe to be running
- Auto mode requires valid memory offsets for the current D2R version
- If memory reading fails (invalid offsets, D2R not running, version mismatch), auto mode will not work
- Users must use manual run controls (keyboard shortcuts) when auto mode cannot operate
- Save file monitoring continues to run for **item detection only** (via SaveFileMonitor)

## Safety Considerations

1. **Single-Player Only**: Memory reading should only be used for single-player mode
2. **No Game Modification**: Only read memory, never write
3. **Error Handling**: Gracefully handle permission errors, process crashes
4. **Windows Only**: Auto mode is only available on Windows platforms

## Current Status

- ✅ Infrastructure: ProcessMonitor, MemoryReader structure implemented
- ✅ Integration: RunTrackerService integrated with memory reading
- ✅ Settings: UI controls for enabling/disabling auto mode (memory reading)
- ✅ **Reference Found**: d2go repository provides working D2R memory reading implementation
- ✅ Memory Addresses: Extracted from d2go/koolo (P1=0x23E6E0, P2=0x8, P3=0x0 for D2R 2.7+)
- ✅ Windows API: Implemented using win32-api library with ReadProcessMemory calls
- ✅ **Auto Mode**: Memory reading only - no save file fallback for run detection

## References

- **[d2go Repository](https://github.com/hectorgimenez/d2go)** - **Primary Reference**: Go implementation of D2R memory reader with data structures
- [MF_run_counter Repository](https://github.com/oskros/MF_run_counter) - Classic D2 memory reading (not D2R)
- [Windows API Documentation](https://docs.microsoft.com/en-us/windows/win32/api/memoryapi/)
- [Cheat Engine](https://cheatengine.org/) - Memory scanning tool

## Priority Action Items

1. **HIGH PRIORITY**: Examine d2go's `pkg/memory` package source code:
   - Direct link: https://github.com/hectorgimenez/d2go/tree/main/pkg/memory
   - Extract memory offsets for game state detection
   - Document data structures used
   - Note any version-specific handling

2. **IMPLEMENTATION**: Adapt d2go's Go implementation to our TypeScript/Node.js codebase:
   - Translate memory reading logic
   - Use same offsets/data structures
   - Implement Windows API calls based on their approach

3. **TESTING**: Validate memory reading works with current D2R version:
   - Test in-game state detection
   - Handle version differences if needed
   - Implement fallback mechanisms

## Notes

- Memory addresses are often version-specific
- Addresses may change with game updates
- Pointer chains may be needed instead of direct offsets
- Consider using signature scanning for more robust address finding

