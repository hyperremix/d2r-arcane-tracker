# Memory Reading Implementation Summary

## Completed Work

### 1. Infrastructure ✅

- **ProcessMonitor Service** (`electron/services/processMonitor.ts`)
  - Detects D2R.exe process using Windows `tasklist` command
  - Emits `d2r-started` and `d2r-stopped` events
  - Windows-only implementation

- **MemoryReader Service** (`electron/services/memoryReader.ts`)
  - Complete structure for Windows memory reading
  - Async/await pattern throughout
  - Base address detection using PowerShell
  - Polling mechanism for game state detection
  - Support for direct offsets and pointer chains
  - Ready to accept memory addresses from d2go

- **RunTrackerService Integration** (`electron/services/runTracker.ts`)
  - Integrated with MemoryReader via EventBus
  - Handles `game-entered` and `game-exited` events
  - Mode switching between memory reading and save file monitoring
  - Graceful fallback to save file monitoring

### 2. Database Schema ✅

- Added `runTrackerMemoryReading` (boolean) setting
- Added `runTrackerMemoryPollingInterval` (number, default 500ms) setting
- Added `getCharacterById()` method for character lookup

### 3. Settings UI ✅

- Toggle for enabling/disabling memory reading (Windows only)
- Slider for polling interval configuration
- Platform-specific warnings and alerts
- Information box explaining the feature

### 4. Event System ✅

- Added `d2r-started` and `d2r-stopped` process events
- Added `game-entered` and `game-exited` memory reading events
- All events properly typed in `electron/types/events.ts`

### 5. Documentation ✅

- **MEMORY_READING.md**: Comprehensive guide on memory reading approach
- **EXTRACT_D2GO_ADDRESSES.md**: Step-by-step guide for extracting memory addresses from d2go
- References to d2go repository and implementation patterns

## Pending Work

### 1. Extract Memory Addresses from d2go ⏳

**Action Required**: Examine d2go's `pkg/memory` package source code

**Steps**:
1. Clone d2go repository: `git clone https://github.com/hectorgimenez/d2go.git`
2. Navigate to `pkg/memory` directory
3. Extract memory offsets for:
   - In-game state flag
   - Game name/ID
   - Character name
4. Update `D2RMemoryAddresses` interface in `memoryReader.ts`

**Documentation**: See `docs/EXTRACT_D2GO_ADDRESSES.md` for detailed instructions

### 2. Implement Windows API Calls ⏳

**Current Status**: Placeholder implementation using PowerShell for base address detection

**Options**:

**Option A: Native C++ Module** (Recommended)
- Create `windows-memory-reader.cpp` native addon
- Wrap Windows API functions: `OpenProcess`, `ReadProcessMemory`, `CloseHandle`, `EnumProcessModules`
- Compile only on Windows builds
- Use `electron-rebuild` for Electron compatibility

**Option B: FFI Library**
- Use `ffi-napi` package (Windows-only builds)
- Requires Windows build environment
- More complex but avoids native C++ code

**Option C: Separate Executable**
- Create small Windows executable wrapper
- Call via `child_process` (slower but simpler)

**Implementation Location**: `electron/services/memoryReader.ts` → `WindowsMemoryReaderImpl.readMemory()`

**Documentation**: See `docs/EXTRACT_D2GO_ADDRESSES.md` for implementation examples

### 3. Error Handling ⏳

**Current Status**: Basic error handling in place, needs enhancement

**Needed**:
- Handle process crashes gracefully
- Handle memory read failures (permissions, invalid addresses)
- Handle version-specific address changes
- Implement automatic fallback to save file monitoring
- Add retry logic for transient failures

### 4. Testing ⏳

**Needed**:
- Unit tests for MemoryReader service
- Unit tests for ProcessMonitor service
- Integration tests for RunTrackerService with memory reading
- Mock Windows API calls for testing
- Test version-specific address handling

## Implementation Architecture

```
ProcessMonitor (detects D2R.exe)
    ↓ emits 'd2r-started' event
MemoryReader (opens process handle)
    ↓ polls memory at intervals
    ↓ reads in-game state flag
    ↓ emits 'game-entered' / 'game-exited' events
RunTrackerService (handles events)
    ↓ starts/stops runs automatically
```

## Key Files

- `electron/services/processMonitor.ts` - Process detection
- `electron/services/memoryReader.ts` - Memory reading implementation
- `electron/services/runTracker.ts` - Run tracking integration
- `electron/types/events.ts` - Event type definitions
- `src/components/settings/RunTrackerSettings.tsx` - UI controls
- `docs/MEMORY_READING.md` - Implementation guide
- `docs/EXTRACT_D2GO_ADDRESSES.md` - d2go extraction guide

## Next Steps

1. **Extract memory addresses** from d2go repository
2. **Implement Windows API calls** using one of the options above
3. **Update memory addresses** in `memoryReader.ts` with extracted values
4. **Test** with actual D2R process
5. **Add error handling** and fallback mechanisms
6. **Write tests** for the implementation

## Notes

- Memory reading is Windows-only (as intended)
- Implementation gracefully falls back to save file monitoring if memory reading fails
- Structure is ready to accept memory addresses once extracted from d2go
- All async operations properly handled
- Event-driven architecture keeps components decoupled

