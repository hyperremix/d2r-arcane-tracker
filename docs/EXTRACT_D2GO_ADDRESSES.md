# Extracting D2R Memory Addresses from d2go

## Overview

The [d2go repository](https://github.com/hectorgimenez/d2go) provides a working Go implementation of D2R memory reading. This document explains how to extract the memory addresses and structures needed for our TypeScript implementation.

## Step 1: Examine d2go's Memory Package

### Repository Structure

Navigate to: https://github.com/hectorgimenez/d2go/tree/main/pkg/memory

Key files to examine:
- `reader.go` or `memory.go` - Main memory reading implementation
- `client.go` or `process.go` - Process handle management
- `structures.go` or `types.go` - Data structures for game state
- Any files with "offset" or "address" in the name

### What to Look For

1. **Memory Offsets**:
   - Constants defining memory offsets (e.g., `const InGameOffset = 0x12345678`)
   - Offset calculations
   - Base address detection

2. **Data Structures**:
   - Go structs representing game state
   - Field offsets within structures
   - String/array length definitions

3. **Memory Reading Functions**:
   - Functions that read specific game data
   - How they access memory (direct offsets vs pointer chains)
   - Error handling patterns

## Step 2: Extract Memory Addresses

### Example Pattern to Look For

In Go code, you might see something like:

```go
const (
    BaseAddressOffset = 0x12345678
    InGameFlagOffset = 0x12345680
    GameNameOffset   = 0x12345690
    CharacterNameOffset = 0x12345700
)

type GameState struct {
    InGame        uint32 `offset:"0x0"`
    GameName      string `offset:"0x10"`
    CharacterName string `offset:"0x50"`
}
```

### Mapping to Our Implementation

Extract these values and update `D2RMemoryAddresses` interface in `memoryReader.ts`:

```typescript
this.addresses = {
  baseAddress: null, // Will be detected at runtime
  inGameStateOffset: '0x12345680', // From d2go
  gameIdOffset: '0x12345690',      // From d2go
  characterNameOffset: '0x12345700', // From d2go
  gameVersion: 'v1.x.x', // Note the version these offsets work for
  usePointerChain: false, // Or true if d2go uses pointer chains
};
```

## Step 3: Understand Memory Reading Patterns

### Direct Offset Pattern

If d2go uses direct offsets:
```go
baseAddress := getModuleBase("D2R.exe")
inGameFlag := baseAddress + InGameFlagOffset
```

Our implementation:
```typescript
const address = this.calculateAddress(this.addresses.inGameStateOffset);
const value = await this.memoryReader.readInt32(this.processHandle, address);
```

### Pointer Chain Pattern

If d2go uses pointer chains:
```go
basePtr := readPointer(baseAddress + BasePointerOffset)
gameStatePtr := readPointer(basePtr + GameStateOffset)
inGameFlag := readPointer(gameStatePtr + InGameFlagOffset)
```

Our implementation:
```typescript
this.addresses.usePointerChain = true;
this.addresses.pointerChain = [0x12345678, 0x10, 0x20]; // Base offset, then chain offsets
```

## Step 4: Implement Windows API Calls

### Option A: Native Module (Recommended for Production)

Create a small native C++ addon that wraps Windows API calls:

```cpp
// windows-memory-reader.cpp
#include <windows.h>
#include <node.h>

Napi::Value OpenProcess(const Napi::CallbackInfo& info) {
    DWORD pid = info[0].As<Napi::Number>().Uint32Value();
    HANDLE handle = OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, FALSE, pid);
    return Napi::Number::New(info.Env(), reinterpret_cast<uintptr_t>(handle));
}

Napi::Value ReadProcessMemory(const Napi::CallbackInfo& info) {
    HANDLE handle = reinterpret_cast<HANDLE>(info[0].As<Napi::Number>().Uint64Value());
    uintptr_t address = info[1].As<Napi::Number>().Uint64Value();
    size_t size = info[2].As<Napi::Number>().Uint32Value();
    
    void* buffer = malloc(size);
    SIZE_T bytesRead = 0;
    BOOL success = ReadProcessMemory(handle, (LPCVOID)address, buffer, size, &bytesRead);
    
    if (success) {
        Napi::Buffer<char> result = Napi::Buffer<char>::Copy(info.Env(), (char*)buffer, size);
        free(buffer);
        return result;
    }
    
    free(buffer);
    return info.Env().Null();
}
```

### Option B: Use Existing Package (Simpler)

For Windows-only builds, consider using:
- `memoryjs` - Windows memory reading library (may require native compilation)
- Custom PowerShell/VBScript wrapper (slower but no compilation needed)

### Option C: FFI with Conditional Build

Use `ffi-napi` but only compile on Windows:
- Mark as optional dependency
- Only build when on Windows
- Use fallback implementation on other platforms

## Step 5: Update Our Implementation

Once memory addresses are extracted:

1. **Update `D2RMemoryAddresses` in `memoryReader.ts`**:
   ```typescript
   this.addresses = {
     baseAddress: null, // Detected at runtime
     inGameStateOffset: '0x[EXTRACTED_FROM_D2GO]',
     gameIdOffset: '0x[EXTRACTED_FROM_D2GO]',
     characterNameOffset: '0x[EXTRACTED_FROM_D2GO]',
     gameVersion: '[D2R_VERSION]',
     usePointerChain: [true/false],
     pointerChain: [offsets if needed],
   };
   ```

2. **Implement Windows API calls**:
   - Update `WindowsMemoryReaderImpl.readMemory()` with actual `ReadProcessMemory` call
   - Update `WindowsMemoryReaderImpl.openProcess()` with actual `OpenProcess` call
   - Update `WindowsMemoryReaderImpl.getModuleBaseAddress()` with `EnumProcessModules` API

3. **Test with actual D2R process**:
   - Verify base address detection works
   - Test memory reading with known addresses
   - Validate game state detection

## Current Status

- ✅ Structure ready to accept memory addresses
- ✅ Base address detection implemented (using PowerShell)
- ⏳ Need to extract actual offsets from d2go
- ⏳ Need to implement actual Windows API calls (ReadProcessMemory, etc.)

## Next Actions

1. **Examine d2go source code**:
   - Clone the repository: `git clone https://github.com/hectorgimenez/d2go.git`
   - Navigate to `pkg/memory` directory
   - Extract memory offsets and structures
   - Document findings

2. **Update implementation**:
   - Add extracted offsets to `memoryReader.ts`
   - Implement Windows API calls (native module or FFI)
   - Test with D2R running

3. **Handle version differences**:
   - D2R updates may change memory layouts
   - Implement version detection
   - Store offsets per game version

## References

- [d2go Repository](https://github.com/hectorgimenez/d2go) - Primary source for memory addresses
- [d2go Memory Package](https://github.com/hectorgimenez/d2go/tree/main/pkg/memory) - Direct link to memory reading code
- [Windows API Documentation](https://docs.microsoft.com/en-us/windows/win32/api/memoryapi/) - ReadProcessMemory documentation

