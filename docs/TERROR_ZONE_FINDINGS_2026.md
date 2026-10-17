# Offline terror zone schedule: findings (October 2026)

Supersedes the conclusions in the 2025 documents on this branch, which tested a game config that is no longer current, and modelled the
rotation as a bag or as independent draws, which it is not.

## The current config (3.x, Reign of the Warlock)

`hd/global/excel/desecratedzones.json` in retail D2R now has a single config:

| Field | Value |
| --- | --- |
| `start_time_utc` | `2025-12-05 00:00:00` |
| `seed` | `16665365343970128666` |
| `zone_duration_minutes` | `30` |
| `break_duration_minutes` | `0` |
| `zones` | 34 (Act1-BurialGrounds … Act5-WorldstoneKeep) |

The branch's `desecratedzones.json` (start 2023-01-27, seed `16664395743969097666`, 60 minutes, 36 zones) and `terrorzone-schedule.csv`
are from before that patch. The CSV switches config on 2025-12-05.

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
it, which is why the 30+ generators tried on this branch never got above chance.

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

## What it would take

The routine is in the game executable. [SirCabby/D2RCabbyCodes](https://github.com/SirCabby/D2RCabbyCodes/blob/main/src/sites.cpp)
locates it in 3.3 as `DesecrateGetCurrentScheduledZone` (RVA `0x35B380`) and `DesecrateGetConfigForTime` (RVA `0x35DB10`), with byte
patterns that survive patches. Decompiling those two functions in Ghidra would give the exact generator, seeding, weights and zone order.
That needs a local `D2R.exe`.

## Options for the app

1. **Use d2emu's file.** Fetch and cache `tz-2023-localized.json`, look up the current slot. It is accurate and localized, but depends on a
   third party (ask d2emu before relying on it), and it is only right for an unmodified `desecratedzones.json`. The app's own Terror Zone
   Configuration page changes the zone list, so it changes the schedule.
2. **Port the game's routine** after decompiling it as above. This works for any config, including one edited by the app, with no network.
3. **Let the app pick the schedule.** The app already writes `desecratedzones.json` for `-direct -txt` players, and the format allows a list of
   configs with start and end times. It could write consecutive single-zone windows and know the schedule exactly. Untested: whether the game
   honours many configs, and how it behaves with a single zone.
