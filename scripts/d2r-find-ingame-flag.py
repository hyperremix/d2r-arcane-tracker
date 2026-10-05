#!/usr/bin/env python3
"""Finds the in-game flag offset of the running D2R.exe build (Windows only, no dependencies).

Use this after a D2R patch, when run detection stops working and the build is not in
KNOWN_D2R_BUILDS (electron/config/d2rBuilds.ts).

    python scripts/d2r-find-ingame-flag.py [seconds]      (default: 90)

While it runs: start in the lobby / character select, enter a game, stay a while (10-20s),
then leave back to the lobby. The script watches every readable data page of D2R.exe and
reports bytes that only ever hold 0 or 1 and flipped while you did that. The in-game flag is
the one that flipped exactly once up and once down and was 1 for the whole time you were in the
game ("longest 1"); other candidates flip for a moment during loading or the quit menu.

It prints the PE identity (timestamp + image size) and the RVA, i.e. everything needed for a
KNOWN_D2R_BUILDS entry. Verify the result before adding it: the byte must be 0 in the lobby and
1 in a game, and nothing else near it should do the same.
"""

import ctypes
import ctypes.wintypes as wt
import struct
import subprocess
import sys
import time

PROCESS_VM_READ = 0x0010
PROCESS_QUERY_INFORMATION = 0x0400
MEM_COMMIT = 0x1000
READABLE_DATA = (0x02, 0x04, 0x08)  # PAGE_READONLY, PAGE_READWRITE, PAGE_WRITECOPY


class MBI(ctypes.Structure):
    _fields_ = [
        ("BaseAddress", ctypes.c_void_p),
        ("AllocationBase", ctypes.c_void_p),
        ("AllocationProtect", wt.DWORD),
        ("pad", wt.DWORD),
        ("RegionSize", ctypes.c_size_t),
        ("State", wt.DWORD),
        ("Protect", wt.DWORD),
        ("Type", wt.DWORD),
    ]


k32 = ctypes.WinDLL("kernel32", use_last_error=True)
k32.OpenProcess.restype = wt.HANDLE
k32.ReadProcessMemory.argtypes = [
    wt.HANDLE,
    ctypes.c_void_p,
    ctypes.c_void_p,
    ctypes.c_size_t,
    ctypes.POINTER(ctypes.c_size_t),
]
k32.VirtualQueryEx.argtypes = [wt.HANDLE, ctypes.c_void_p, ctypes.POINTER(MBI), ctypes.c_size_t]


def powershell(script):
    return subprocess.check_output(["powershell", "-Command", script]).decode().strip()


def read(handle, address, size):
    buf = (ctypes.c_ubyte * size)()
    got = ctypes.c_size_t(0)
    ok = k32.ReadProcessMemory(handle, ctypes.c_void_p(address), buf, size, ctypes.byref(got))
    return bytes(buf[: got.value]) if ok and got.value == size else None


def data_regions(handle, base, size):
    """(rva, length) of committed, readable, non-executable regions inside the module."""
    regions = []
    rva = 0
    while rva < size:
        mbi = MBI()
        if not k32.VirtualQueryEx(handle, ctypes.c_void_p(base + rva), ctypes.byref(mbi), ctypes.sizeof(mbi)):
            break
        length = min(mbi.RegionSize, size - rva)
        if mbi.State == MEM_COMMIT and (mbi.Protect & 0xFF) in READABLE_DATA and not mbi.Protect & 0x100:
            regions.append((rva, length))
        rva += mbi.RegionSize
    return regions


def main():
    duration = float(sys.argv[1]) if len(sys.argv) > 1 else 90
    pid = int(powershell("(Get-Process D2R -ErrorAction Stop).Id"))
    info = powershell(
        "$m=(Get-Process -Id %d).Modules | ? { $_.ModuleName -eq 'D2R.exe' }; "
        "$m.BaseAddress.ToString('X') + ',' + $m.ModuleMemorySize" % pid
    )
    base_hex, size_text = info.split(",")
    base, size = int(base_hex, 16), int(size_text)
    handle = k32.OpenProcess(PROCESS_VM_READ | PROCESS_QUERY_INFORMATION, False, pid)
    if not handle:
        sys.exit(f"OpenProcess failed ({ctypes.get_last_error()}); try an elevated terminal")

    header = read(handle, base, 0x400)
    pe = struct.unpack_from("<I", header, 0x3C)[0]
    timestamp = struct.unpack_from("<I", header, pe + 8)[0]
    size_of_image = struct.unpack_from("<I", header, pe + 24 + 56)[0]
    version = powershell("(Get-Process -Id %d).MainModule.FileVersionInfo.FileVersion" % pid)
    print(f"D2R {version}: timeDateStamp={timestamp} sizeOfImage={size_of_image} pid={pid}")

    regions = data_regions(handle, base, size)
    print(f"watching {sum(n for _, n in regions) // 1024 // 1024} MiB of data for {duration:.0f}s ...")
    print("lobby -> enter a game -> stay 10-20s -> leave to the lobby")

    prev = {}
    tracked = {}  # rva -> list of (time, value)
    blacklist = set()
    start = time.time()
    while time.time() - start < duration:
        now = time.time() - start
        for rva, length in regions:
            chunk = read(handle, base + rva, length)
            if chunk is None:
                continue
            old = prev.get(rva)
            prev[rva] = chunk
            if old is None or old == chunk:
                continue
            # only the bytes that changed need a Python-level look
            for i in range(length):
                if old[i] == chunk[i]:
                    continue
                at = rva + i
                if at in blacklist:
                    continue
                if old[i] > 1 or chunk[i] > 1:
                    blacklist.add(at)
                    tracked.pop(at, None)
                    continue
                history = tracked.setdefault(at, [(0.0, old[i])])
                history.append((now, chunk[i]))
                if len(history) > 12:  # counters / noisy bytes
                    blacklist.add(at)
                    tracked.pop(at, None)
        time.sleep(0.5)

    end = time.time() - start
    rows = []
    for at, history in tracked.items():
        values = {v for _, v in history}
        if values != {0, 1}:
            continue
        longest_one = 0.0
        for (t0, v), (t1, _) in zip(history, history[1:] + [(end, 0)]):
            if v == 1:
                longest_one = max(longest_one, t1 - t0)
        flips, final = len(history) - 1, history[-1][1]
        # the flag goes 0 -> 1 -> 0 exactly once; anything that ended on 1 is still "in game"
        rows.append((final == 0 and flips == 2, longest_one, at, flips, final))
    rows.sort(reverse=True)

    print(f"\n{'RVA':>12}  {'longest 1':>9}  {'flips':>5}  final")
    for clean, longest_one, at, flips, final in rows[:15]:
        note = "   <- 0->1->0 once" if clean else ""
        print(f"  0x{at:08X}  {longest_one:8.1f}s  {flips:5d}  {final}{note}")
    if not rows:
        print("  no 0/1 bytes flipped; did you enter and leave a game while it ran?")


if __name__ == "__main__":
    main()
