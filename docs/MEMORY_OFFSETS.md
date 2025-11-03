# D2R Memory Offsets Documentation

This document contains memory offsets and configuration for Diablo II: Resurrected (D2R) memory reading functionality.

## Architecture Overview

The memory reading implementation uses a **3-level pointer chain architecture**:

```
P_0 (Base Address) + P_1 (Volatile RVA) → Read QWORD (8 bytes) → A_2 (Global Game Context Pointer)
A_2 + P_2 (Structural Offset 1) + P_3 (Structural Offset 2) → Final Address
Final Address → Read DWORD (4 bytes) → Game State Value
```

### Components

- **P_0**: Base address of D2R.exe module (detected at runtime via `EnumProcessModules` or PowerShell)
- **P_1**: Volatile RVA (Relative Virtual Address) - **changes with each D2R patch** - version-specific
- **P_2**: Structural offset 1 (stable across patches)
- **P_3**: Structural offset 2 (stable across patches)
- **A_2**: Global Game Context Pointer (read from memory at P_0 + P_1)

### Game State Values

- **0x00**: Lobby/Menu (Game Ended)
- **0x02**: In-Game (Game Active)

## Offset Extraction

### From d2go Repository

The [d2go repository](https://github.com/hectorgimenez/d2go) by hectorgimenez provides a Go implementation of D2R memory reading.

**Steps to extract offsets:**

1. Clone the repository:
   ```bash
   git clone https://github.com/hectorgimenez/d2go.git
   cd d2go
   ```

2. Navigate to the memory package:
   ```bash
   cd pkg/memory
   ```

3. Examine the source files for:
   - Base address detection logic
   - Pointer chain offsets
   - Game state reading implementation

4. Look for:
   - `pkg/memory/*.go` files containing offset definitions
   - Constants or variables defining P_1, P_2, P_3 offsets
   - Version-specific offset handling

### From ResurrectedTrade Repository

The [ResurrectedTrade repository](https://github.com/ResurrectedTrader/ResurrectedTrade) provides a C# implementation.

**Steps to extract offsets:**

1. Clone the repository:
   ```bash
   git clone https://github.com/ResurrectedTrader/ResurrectedTrade.git
   cd ResurrectedTrade
   ```

2. Locate memory reading code:
   - Look for C# files related to memory reading
   - Check for offset definitions or configuration files
   - Examine version-specific offset handling

3. Extract:
   - P_1 offset (volatile RVA) for each D2R version
   - P_2 and P_3 offsets (structural offsets)
   - Version detection logic

## Adding New Version Offsets

When a new D2R patch is released, follow these steps:

1. **Detect the new version**:
   - Run D2R and check the executable version
   - Use PowerShell: `(Get-Item "D2R.exe").VersionInfo.FileVersion`

2. **Extract P_1 offset**:
   - Use Cheat Engine or similar tool to scan memory
   - Find the address that changes with the patch
   - Calculate P_1 as: `(Address - BaseAddress)`
   - Verify P_2 and P_3 remain stable

3. **Update `electron/config/d2rOffsets.ts`**:
   ```typescript
   '1.2.3': {
     p1: 0x12345678,  // New volatile RVA
     p2: 0x10,        // Usually stable
     p3: 0x20,        // Usually stable
     version: '1.2.3',
     build: 'build12345',
     notes: 'Patch 1.2.3 offsets',
   },
   ```

4. **Test the offsets**:
   - Start D2R
   - Enable memory reading in the app
   - Verify game state detection works correctly
   - Test transitions: Lobby → InGame → Lobby

5. **Document in this file**:
   - Add version entry below
   - Note any changes to P_2 or P_3
   - Document testing results

## Version History

### D2R 2.7+ (Current)

- **Status**: ✅ Active - Offsets extracted from d2go/koolo
- **P_1**: 0x23E6E0 (RVA from D2R.exe base address)
- **P_2**: 0x8 (Structural offset 1)
- **P_3**: 0x0 (Structural offset 2)
- **Source**: [d2go/koolo repository](https://github.com/hectorgimenez/d2go)
- **Notes**: Valid for D2R patch 2.7 and later versions. Volatility mechanism: Compiler/Linker Relocation

### Placeholder (Legacy)

- **Status**: Deprecated - Use 2.7+ offsets instead
- **P_1**: 0x0 (Placeholder)
- **P_2**: 0x0 (Placeholder)
- **P_3**: 0x0 (Placeholder)
- **Notes**: These were placeholder values before actual offsets were extracted

## Implementation Details

### Pointer Chain Resolution

The `resolvePointerChain()` method in `electron/services/memoryReader.ts` implements:

1. **Calculate A_1**: `A_1 = P_0 + P_1`
2. **Read QWORD**: Read 8 bytes at A_1 to get A_2 (64-bit pointer)
3. **NULL Check**: If A_2 is 0x00, return 0 (Game Ended state)
4. **Calculate Final**: `Final = A_2 + P_2 + P_3`

### Version Detection

The `detectD2RVersion()` function:

1. Gets process executable path using WMIC
2. Reads file version using PowerShell
3. Returns version string (e.g., "1.0.0.12345")
4. Used to lookup offsets from `D2R_OFFSET_MAP`

### Error Handling

- **Invalid offsets**: If offsets are 0x0 (placeholders), memory reading is disabled
- **Version not found**: Falls back to default offsets (which are invalid)
- **NULL pointer**: If A_2 is 0x00, returns Game Ended state
- **Read failures**: Returns null, polling continues

## References

- [d2go Repository](https://github.com/hectorgimenez/d2go) - Go implementation
- [ResurrectedTrade Repository](https://github.com/ResurrectedTrader/ResurrectedTrade) - C# implementation
- [Windows API Documentation](https://learn.microsoft.com/en-us/windows/win32/api/memoryapi/nf-memoryapi-readprocessmemory)
- [Pointer Chain Architecture](docs/MEMORY_READING.md)

## Troubleshooting

### Memory Reading Not Working

1. **Check version detection**:
   - Verify D2R.exe version is detected correctly
   - Check console logs for version string

2. **Verify offsets**:
   - Ensure offsets are valid (not 0x0)
   - Check `D2R_OFFSET_MAP` contains entry for detected version

3. **Check permissions**:
   - App may need administrator privileges on Windows
   - Verify process handle can be opened

4. **Verify D2R is running**:
   - Check ProcessMonitor detects D2R.exe
   - Verify process ID is valid

### Offsets Invalid Error

- **Cause**: Placeholder offsets (0x0) in configuration
- **Solution**: Extract actual offsets from d2go or ResurrectedTrade
- **Fallback**: App automatically falls back to save file monitoring

### Game State Not Detected

- **Check pointer chain**: Verify A_2 is not NULL
- **Check state values**: Verify reading 0x00 or 0x02 values
- **Check polling**: Ensure polling is active and interval is appropriate

