# D2R Terror Zone Algorithm - Reverse Engineering Summary

## Quick Summary

After extensive analysis and testing of 15+ algorithm variations, **the exact PRNG algorithm used by Diablo II: Resurrected for single-player Terror Zone generation could not be determined** through black-box reverse engineering of the available data.

## What We Know

### Configuration Data (desecratedzones.json)
```json
{
  "seed": 16664395743969097666,  // 64-bit unsigned integer
  "start_time_utc": "2023-01-27 00:00:00",
  "terror_duration_min": 60,
  "terror_break_min": 0,
  "zones": 36  // Total number of terror zones
}
```

### Schedule Data Analysis
- **Sources**: https://d2emu.com/tz-sp, https://www.d2tz.info/offline, https://d2runewizard.com/terror-zone-tracker/single-player
- **Sample Size (current CSV)**: 5,281 hourly entries
- **Distinct Zones**: 36
- **Minimal Period Detected**: 5,281 (no short repeating cycle within observed horizon)
- **Distribution**: Near-uniform; counts mean ≈ 146.7, std ≈ 6.85 across zones
- **Minimum Repeat Gap**: 2 hours (implies immediate-repeat ban only)
- **Daily Behavior**: Duplicates occur within a day (no per-day uniqueness)

## Zone ID Mapping

Successfully mapped all 36 terror zones from configuration to IDs:

| ID | Zone Name |
|----|-----------|
| 1  | Burial Grounds, Crypt, Mausoleum |
| 2  | Cathedral, Catacombs |
| 3  | Cold Plains, Cave |
| 4  | Dark Wood, Underground Passage |
| 5  | Blood Moor, Den of Evil |
| 6  | Barracks, Jail |
| 7  | The Secret Cow Level |
| 8  | Stony Field |
| 9  | Black Marsh, The Hole |
| 10 | Forgotten Tower |
| 11 | Pit |
| 12 | Tristram |
| 13 | Lut Gholein Sewers |
| 14 | Rocky Waste, Stony Tomb |
| 15 | Dry Hills, Halls of the Dead |
| 16 | Far Oasis |
| 17 | Lost City, Valley of Snakes, Claw Viper Temple |
| 18 | Ancient Tunnels |
| 19 | Tal Rasha's Tombs, Tal Rasha's Chamber |
| 20 | Arcane Sanctuary |
| 21 | Spider Forest, Spider Cavern |
| 22 | Great Marsh |
| 23 | Flayer Jungle, Flayer Dungeon |
| 24 | Kurast Bazaar, Ruined Temple, Disused Fane |
| 25 | Travincal |
| 26 | Durance of Hate |
| 27 | Outer Steppes, Plains of Despair |
| 28 | City of the Damned, River of Flame |
| 29 | Chaos Sanctuary |
| 30 | Bloody Foothills, Frigid Highlands, Abaddon |
| 31 | Arreat Plateau, Pit of Acheron |
| 32 | Crystalline Passage, Frozen River |
| 33 | Nihlathak's Temple, Temple Halls |
| 34 | Glacial Trail, Drifter Cavern |
| 35 | Ancient's Way, Icy Cellar |
| 36 | Worldstone Keep, Throne of Destruction, Worldstone Chamber |

## Algorithms Tested (All Failed)

1. **64-bit LCG** (various multipliers and increments)
2. **Java Random** (48-bit LCG)
3. **Mersenne Twister MT19937**
4. **Xorshift64**
5. **PCG** (Permuted Congruential Generator)
6. **Fisher-Yates Shuffle** with bag system
7. **Hash-based approaches** (seed + time)
8. **Multiplicative approaches** (seed * time)
9. **XOR combinations** (seed ^ time)
10. **Multiple time bases** (Unix epoch, hours from start, etc.)

**Best Predictive Match**: No meaningful prefix; best matches only 2–3 hours. Accuracy remains near random baseline for 36 classes.

## Why the Algorithm Resists Reverse Engineering

### Complexity Factors
1. **Non-Standard PRNG**: Likely using a custom or proprietary algorithm
2. **Additional State**: May maintain state beyond just the seed
3. **Filtering/Weighting**: Possible zone exclusion or preference logic
4. **Version Changes**: Seed or algorithm may have changed between game versions

### Data Caveats
1. **Single Known Seed**: Only one seed value available from `desecratedzones.json`
2. **Potential Version Drift**: Game updates may alter seed/logic
3. **Extraction Provenance**: Community CSVs may reflect specific builds/patches

## Recommended Approaches for Implementation

### ✅ Approach 1: Use Pre-Computed Data (RECOMMENDED)
```typescript
// Import schedule from d2emu.com
import terrorZoneSchedule from './terrorzone-schedule.csv';

function getCurrentTerrorZone(currentTime: Date): TerrorZone {
  const roundedHour = roundToHour(currentTime);
  return lookupZone(terrorZoneSchedule, roundedHour);
}
```

**Pros**: 
- Works immediately
- Accurate (if CSV is correct)
- No algorithm needed

**Cons**:
- Requires updating CSV periodically
- File size (~20KB for 1 year of data)

### 🔄 Approach 2: API Integration
```typescript
async function getCurrentTerrorZone(): Promise<TerrorZone> {
  const response = await fetch('https://d2emu.com/api/tz-sp/current');
  return await response.json();
}
```

**Pros**:
- Always up-to-date
- No local storage needed

**Cons**:
- Requires internet connection
- Depends on external service availability

### ⚠️ Approach 3: Binary Reverse Engineering
Disassemble the D2R game executable to find the actual implementation.

**Pros**:
- Would reveal true algorithm

**Cons**:
- Complex and time-consuming
- May violate EULA
- Requires advanced reverse engineering skills

## Practical Implementation Example

```typescript
interface TerrorZone {
  id: number;
  name: string;
  levels: string[];
  waypointId: number;
}

class TerrorZoneTracker {
  private schedule: Map<string, TerrorZone>;
  
  constructor(scheduleData: ScheduleEntry[]) {
    this.schedule = new Map();
    for (const entry of scheduleData) {
      const key = entry.timestamp;  // ISO format hour
      this.schedule.set(key, this.getZoneById(entry.zoneId));
    }
  }
  
  getCurrentZone(time: Date = new Date()): TerrorZone | null {
    const hourKey = this.getHourKey(time);
    return this.schedule.get(hourKey) || null;
  }
  
  getNextZone(time: Date = new Date()): TerrorZone | null {
    const nextHour = new Date(time);
    nextHour.setHours(nextHour.getHours() + 1);
    const hourKey = this.getHourKey(nextHour);
    return this.schedule.get(hourKey) || null;
  }
  
  getTimeUntilNext(time: Date = new Date()): number {
    const nextHour = new Date(time);
    nextHour.setHours(nextHour.getHours() + 1, 0, 0, 0);
    return nextHour.getTime() - time.getTime();
  }
  
  private getHourKey(time: Date): string {
    const hourDate = new Date(time);
    hourDate.setMinutes(0, 0, 0);
    return hourDate.toISOString();
  }
  
  private getZoneById(id: number): TerrorZone {
    // Lookup zone from desecratedzones.json configuration
    // ... implementation ...
  }
}
```

## Conclusion

While we successfully:
- ✅ Mapped all 36 terror zones
- ✅ Analyzed distribution patterns
- ✅ Tested 15+ algorithm variations
- ✅ Identified timing relationships

We were **unable to determine the exact algorithm** through black-box analysis.

### Final Recommendation

**For D2R Arcane Tracker**: Use the pre-computed schedule from community sources (e.g., d2emu.com) for exact results, while treating the algorithm as a deterministic hourly PRNG with immediate-repeat rejection and near-uniform distribution.

The community has already done the hard work of extracting the schedule, so there's no need to reinvent the wheel. Focus on providing great UX around displaying and tracking this information for players.

---

## Files Generated

Analysis scripts created during this investigation:
- `scripts/reverse-engineer-tz.ts` - Main PRNG testing suite
- `scripts/analyze-pattern.ts` - Pattern and cycle detection
- `scripts/test-shuffle.ts` - Fisher-Yates and MT19937 testing
- `scripts/test-combined-seed.ts` - Seed+time combination testing
- `scripts/detailed-analysis.ts` - Comprehensive data analysis

All scripts can be run with:
```bash
npx tsx scripts/<script-name>.ts
```

## References

- [D2R Terror Zone Calendar](https://d2emu.com/tz-sp) - Community-maintained schedule
- [Single Player TZ Tracker (offline)](https://www.d2tz.info/offline)
- [Single Player TZ Calendar](https://d2runewizard.com/terror-zone-tracker/single-player)
- [D2R Wiki - Terror Zones](https://d2rr.wiki.gg) - Game mechanics documentation
- Game files: `data/hd/global/excel/desecratedzones.json`

---

**Report Date**: October 25, 2025  
**Investigation Duration**: Extensive analysis with multiple approaches  
**Outcome**: Algorithm not determined, practical alternatives identified

