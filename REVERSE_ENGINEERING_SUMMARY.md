# D2R Single Player Terror Zone Algorithm - Reverse Engineering Summary

## Quick Answer

❌ **Algorithm not successfully reverse-engineered**

✅ **Strong evidence of bag/shuffle system with ~36-hour cycle**

✅ **Practical solution identified: Use pre-computed schedule data**

## What We Know For Sure

### The Schedule is Deterministic and Global

- All community trackers show the same schedule
- Multiple independent sources confirm schedules match
- Schedule can be predicted hours/days in advance

### Pattern Analysis Findings

1. **No consecutive duplicates** (100% enforced)
2. **Average repeat distance: ~36 hours** (exactly the number of zones!)
3. **Near-uniform distribution** (all zones appear roughly equally)
4. **Minimum repeat distance: 3 hours** (same zone can repeat quickly, but rarely)
5. **No hour-of-day or day-of-week patterns**
6. **No repeating subsequences** found

### Configuration Data (from game files)

```json
{
  "seed": 16664395743969097666,
  "start_time_utc": "2023-01-27 00:00:00",
  "terror_duration_min": 60,
  "zones": 36
}
```

## What We Tested (All Failed)

### PRNG Algorithms

- ❌ Linear Congruential Generator (LCG) - Multiple variants
- ❌ Mersenne Twister MT19937 (32-bit and 64-bit)
- ❌ Xorshift64
- ❌ PCG32 (Permuted Congruential Generator)
- ❌ Xoshiro256++
- ❌ SplitMix64
- ❌ Various hash-based approaches

**Best accuracy: ~5% (essentially random guessing for 36 zones)**

### Bag/Shuffle Systems

- ❌ Fisher-Yates shuffle with various PRNGs
- ❌ Periodic reshuffling (tested periods: 36, 72, 100, 144, 200, 288 hours)
- ❌ Bag systems with duplicate prevention

**Best accuracy: ~4%**

## Most Likely Hypothesis

Based on the pattern analysis, the algorithm most likely works like this:

```
1. Create a bag containing all 36 zones
2. Shuffle the bag using PRNG(seed + bag_number)
3. Draw zones from the bag sequentially
4. If drawn zone == previous zone, skip to next (prevents duplicates)
5. When bag exhausted, create new bag with incremented seed
```

**Why we can't crack it:**

- We don't know the exact PRNG used (custom implementation?)
- We don't know the exact seeding strategy
- The seed in the config file might not be the actual seed used
- May use multiple RNG states or additional hidden factors

## Recommended Solution for D2R Arcane Tracker

### Use Pre-Computed Schedule Data ✅

```typescript
// Import from community sources (d2emu.com)
import terrorZoneSchedule from './data/terrorzone-schedule.csv';

class TerrorZoneTracker {
  getCurrentZone(currentTime: Date): TerrorZone {
    const hour = getHoursSince(START_TIME, currentTime);
    return scheduleData.get(hour);
  }
  
  getNextZone(currentTime: Date): TerrorZone {
    const nextHour = getHoursSince(START_TIME, currentTime) + 1;
    return scheduleData.get(nextHour);
  }
}
```

**Advantages:**

- ✅ 100% accurate
- ✅ Works immediately
- ✅ Fast O(1) lookups
- ✅ No complex algorithm needed
- ✅ Easy to maintain (update CSV periodically)

**Community Sources:**

- <https://d2emu.com/tz-sp>
- <https://www.d2tz.info/offline>
- <https://d2runewizard.com/terror-zone-tracker/single-player>

## Zone Mapping Reference

| ID | Zone Name | Act |
|----|-----------|-----|
| 1-12 | Act 1 zones (Blood Moor, Burial Grounds, Cathedral, etc.) | 1 |
| 13-20 | Act 2 zones (Sewers, Tombs, Arcane, etc.) | 2 |
| 21-26 | Act 3 zones (Spider Forest, Kurast, Travincal, etc.) | 3 |
| 27-29 | Act 4 zones (Outer Steppes, River of Flame, Chaos) | 4 |
| 30-36 | Act 5 zones (Bloody Foothills, Arreat, Worldstone, etc.) | 5 |

See [TERROR_ZONE_ANALYSIS_2025.md](./docs/TERROR_ZONE_ANALYSIS_2025.md) for complete mapping.

## Key Insights for Future Attempts

If you want to continue trying to crack the algorithm:

1. **Get more data**: Schedule data closer to start time (2023-01-27)
2. **Test obscure PRNGs**: WELL, KISS, Ran2, custom game engine RNGs
3. **Binary analysis**: Reverse engineer the D2R executable
4. **Community research**: Check modding forums for leaked info
5. **Extended testing**: Try every combination of the patterns we found

## Files Created

Analysis scripts in `scripts/`:

- `reverse-engineer-tz.ts` - Basic PRNG testing
- `advanced-tz-analysis.ts` - Extended algorithm tests
- `deep-pattern-analysis.ts` - Statistical pattern discovery
- `bag-shuffle-test.ts` - Bag system implementations

Documentation in `docs/`:

- `TERROR_ZONE_ALGORITHM_ANALYSIS.md` - Initial analysis
- `TERROR_ZONE_REVERSE_ENGINEERING_SUMMARY.md` - Previous summary
- `TERROR_ZONE_ANALYSIS_2025.md` - Comprehensive updated analysis

## Conclusion

The D2R single-player terror zone algorithm uses a sophisticated approach that has resisted black-box reverse engineering. While we've identified strong patterns suggesting a bag/shuffle system, the exact PRNG and implementation details remain unknown.

**For practical purposes, using pre-computed schedule data from community sources is the best approach.** The community has already solved the problem of extracting the schedule, so leverage their work rather than trying to reimplement a proprietary algorithm.

---

**Analysis Completed**: October 23, 2025  
**Total Algorithms Tested**: 30+ variations  
**Schedule Entries Analyzed**: 938  
**Outcome**: Algorithm undetermined, practical solution identified
