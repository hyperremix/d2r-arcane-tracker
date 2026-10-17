# Offline terror zone schedule: findings (October 2026)

## The current config (3.x, Reign of the Warlock)

`hd/global/excel/desecratedzones.json` in retail D2R now has a single config:

| Field | Value |
| --- | --- |
| `start_time_utc` | `2025-12-05 00:00:00` |
| `seed` | `16665365343970128666` |
| `zone_duration_minutes` | `30` |
| `break_duration_minutes` | `0` |
| `zones` | 34 (Act1-BurialGrounds … Act5-WorldstoneKeep) |

Before that patch the config was different (start 2023-01-27, seed `16664395743969097666`, 60 minutes, 36 zones), and the 2025 data was
hourly. The config switched on 2025-12-05.

Sources: a retail file mirrored in [ryan-reid/BT-BKDiff](https://github.com/ryan-reid/BT-BKDiff/blob/main/data/retail/hd/global/excel/desecratedzones.json)
and the schema in [eezstreet/d2rdoc](https://github.com/eezstreet/d2rdoc/blob/master/contrib/guides/desecratedzones.md).

## How d2emu does it

`https://d2emu.com/tz-sp` computes nothing in the browser. `js/tz-sp.js` loads a precomputed, localized file:

- `data/tz-2023-localized.json`: the retail schedule, 30-minute slots, 34 zones, about four months ahead
  (2026-07-15 to 2026-11-12 when checked), names in 12 languages.
- `data/tz-d2rr-localized.json`: the D2R Reimagined mod, 60-minute slots, 36 zones.

d2rwiki.com and d2tz.info also serve precomputed files. None of them publishes the algorithm.

## The rotation is a recency-weighted pick

Measured on d2emu's 5,761 retail slots with `scripts/tz-recency-analysis.mjs`:

- A zone is never picked twice in a row. Otherwise the chance of being picked rises roughly linearly with the number of slots since the zone
  was last picked: 0.07× uniform for the zone picked two slots ago, 2.9× for the zone that has waited longest.
- A model where each zone's weight is `slots since last picked − 1` fits as well as a free per-age weight (log-likelihood −18,489 against
  −18,422 with 130 free parameters, and −19,962 for uniform-without-repeat).
- The 2025 hourly data (36 zones) shows the same curve, so the mechanism predates 3.x.

So the rotation is stateful: each pick depends on every pick since `start_time_utc`. A stateless `rng(seed, slot) % zones` cannot reproduce
it, which is why the 30+ generators tried earlier never got above chance.

## What was tried this time

Assuming one draw per slot and the weights above, the observed history fixes the weights in every slot of d2emu's window. So a candidate
generator can be checked against the data without knowing the initial state. 3,840 combinations were tested, all at chance level
(about 5.5%, since the true zone usually has a large weight):

- Generators: D2's own `SEED` multiply-with-carry (`lo * 0x6AC690C5 + hi`, several seedings), splitmix64, PCG32, MT19937 32 and 64-bit, a
  64-bit LCG, MSVC `rand`.
- Stateful and reseeded per slot from the seed and the slot index or slot time.
- Zone order: file order, reversed, alphabetical, FNV-1a of the zone id.
- Weights: `age` and `age − 1`, scaled by 1, 30 or 1800.
- Mapping: `% total`, multiply-shift, float.

## The algorithm (recovered from D2R 3.3.93847)

The routine was read from the game executable. On disk `.text` is encrypted (entropy ≈ 8 bits per byte) and the code is only readable while
the game runs: about half of it stays `PAGE_NOACCESS` until the game executes it, so the module was dumped read-only (`ReadProcessMemory`
only, offline, after entering a game) and analysed statically in Ghidra. The byte patterns from D2RCabbyCodes do not match this build; the
config lookup sits at RVA `0x2BC800` and the current-zone function at `0x2BCB40`. This section describes the behaviour in words and
pseudocode; no game code is reproduced.

### Config selection

`desecratedzones.json` holds a list of configs. Each one is read into a record: `start_time_utc` and `end_time_utc` become Unix seconds (an
empty or missing `end_time_utc` means "never ends"), `zone_duration_minutes` and `break_duration_minutes` are 32-bit integers, `seed` is an
unsigned 64-bit integer, and the zones are taken in file order. A zone entry that fails a check of the game's own while the file is loaded is skipped, so it takes no part in the rotation. Which check that is was not traced; the retail zones all pass it, and the app does not filter zones.

For a time `t` (UTC seconds) the game walks the configs in file order and uses the first with `start <= t < end`. If none matches there is
no terror zone.

### Slot index

```
period = (zone_duration + break_duration) * 60            // seconds
slot   = floor((t - start) / period)                      // negative slot: no zone
if break_duration != 0 and t >= start + slot * period + zone_duration * 60: no zone (inside the break)
```

### Random roll

For a time `x` (int64 seconds) the roll is

```
roll(x) = uint32_le(sha1(uint64_le(x XOR seed))[0..4]) / 2^32      // a fraction in [0, 1)
```

That is: XOR the 64-bit time with the 64-bit seed, serialise it as 8 little-endian bytes, SHA-1 it, read the first four bytes of the digest
as a little-endian unsigned integer, and divide by 2^32. There is no stateful RNG: every roll is a pure function of one slot time.

### Weights and the pick

The game keeps one `double` weight per zone (`N` zones, summing to 1) and replays every slot from slot 0:

```
w[i]  = 1 / (N - 1) for all i
w[floor(roll(start - period) * N)] = 0                     // a virtual "previous slot" pick

for s = 0 .. slot:
    r = roll(start + period * s)
    cum = 0; pick = N - 1; share = 0                       // falling off the end picks the last zone
    for i = 0 .. N-1:
        cum += w[i]
        if r < cum: pick = i; share = w[i] / (N - 1); break
    for i = 0 .. N-1: w[i] += share                        // hand the picked weight to the other zones
    w[pick] = 0
```

So the zone picked last has weight 0 and cannot repeat, and a zone that sits out gets a bigger share each slot. The game caches the last
computed slot and extends it incrementally (resetting when asked for an earlier slot), which gives the same result as a replay from slot 0.
The arithmetic is IEEE double; summing in file order with `r < cum` (strict) is what matches.

### Other questions

- **Thresholds.** `manual_deprioritize_threshold` and `manual_removal_threshold` are stored in the config record, but the slot and pick
  code never reads them, and the schedule is correct without them. They may be used elsewhere in the game; that was not traced.
- **One zone.** The initial weights are `1/0 = inf`, but the single weight is zeroed, so the loop falls through to the last (only) zone:
  that zone every slot.
- **No zones.** The game's code would index an empty vector. The app treats this as "no schedule".
- **Multiple configs.** The rotation restarts at each config's own `start_time_utc` with its own seed: state is not carried across configs.

### Verification

The pseudocode reproduces d2emu's `tz-2023-localized.json` for all 5,761 slots (2026-07-15 to 2026-11-12), with the 34 zones mapping
one-to-one to d2emu's zone names in file order. It also matched the zone shown in an offline game on 2026-10-17 (16:30–17:00 local: Stony
Field, Tristram). The retail config is the one in the section above.

### Practical consequences

- The seed is a `uint64` above 2^53. `JSON.parse` / `JSON.stringify` round it (`…128666` becomes `…128000`), which changes the whole
  schedule. Read it as text and keep it a `BigInt`. The game uses whatever seed is in the file. Until this was fixed, the Terror Zone
  Configuration page rounded the seed on every save, so a file it saved earlier may still carry a rounded seed (`…128000`); **Restore
  original** brings back the retail seed.
- The schedule depends on the exact zone list and order, so editing the list in the app changes every slot.
