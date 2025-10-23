# Terror Zone Algorithm Reverse Engineering Analysis

## Executive Summary

This document details the reverse engineering effort to determine the algorithm used by Diablo II: Resurrected (D2R) to generate the single-player Terror Zone schedule.

**Status**: Algorithm not yet fully determined. Multiple approaches tested with no successful match.

## Data Sources

### 1. desecratedzones.json
Located in the D2R game files, this configuration file contains:
- **Seed**: `16664395743969097666` (64-bit unsigned integer)
- **Start Time**: `2023-01-27 00:00:00 UTC`
- **Terror Duration**: 60 minutes
- **Terror Break**: 0 minutes
- **Zone Definitions**: 36 different terror zones, each with an ID (1-36) and associated game levels

### 2. terrorzone-schedule.csv
From community trackers (e.g., d2emu.com), contains:
- **Coverage**: Extended dataset
- **Entries**: 5,281 hourly terror zone assignments (as of Oct 25, 2025)
- **Format**: ISO datetime, Zone Name

## Zone Distribution Analysis

The schedule shows relatively even distribution of zones over 5,281 entries:
- Mean count ≈ 146.7 per zone (36 zones total), std ≈ 6.85
- No consecutive duplicates (immediate-repeat ban)
- Duplicates occur within a day (no per-day uniqueness)

### Repeat Distance Analysis

Most common distances between zone repeats:
- Distance 10: 28 occurrences
- Distance 12: 26 occurrences  
- Distance 11: 24 occurrences
- Distance 13-16: 13-19 occurrences each

Minimum repeat gap observed is 2 hours; average spacing is consistent with near-uniform selection over 36 zones, not a fixed 36-length cycle.

## Algorithms Tested

### 1. Linear Congruential Generator (LCG)

**Approach**: Standard 64-bit LCG with constants:
```
multiplier (a) = 6364136223846793005
increment (c)  = 1442695040888963407
state_next = (state * a + c) mod 2^64
zone = (state mod 36) + 1
```

**Results**: 
- Direct application: 2-5% accuracy
- With hour offset: 2% accuracy
- **Conclusion**: Does not match the schedule

### 2. Mersenne Twister (MT19937)

**Approach**: Standard MT19937 implementation with seed initialization

**Results**: 1% accuracy
**Conclusion**: Does not match the schedule

### 3. Xorshift64

**Approach**: 64-bit Xorshift PRNG
```
x ^= x << 13
x ^= x >> 7  
x ^= x << 17
```

**Results**: 4% accuracy
**Conclusion**: Does not match the schedule

### 4. Fisher-Yates Shuffle

**Approach**: Generate bags of all 36 zones, shuffle using LCG, draw from bag

**Results**: 4% accuracy
**Conclusion**: Does not match the schedule

### 5. Seed + Time Combinations

Tested various combinations of seed with timestamp:
- `(seed + hour) -> hash`
- `(seed * hour) -> hash`
- `(seed XOR hour) -> hash`
- PCG-style permutation
- Java Random-style ((seed XOR hour) * 0x5DEECE66D + 0xB)

**Results**: 1-6% accuracy across all variations
**Conclusion**: None match the schedule

### 6. Pre-Shuffled List

**Approach**: Check if schedule repeats at fixed intervals (36, 72, 100, 200, 300)

**Results**: No short repeating pattern found; minimal period equals current dataset length
**Conclusion**: Not a simple pre-shuffled list

## Key Observations

1. **No Statistical Match**: Across PCG/xoshiro/MT and many mixers/cadences, best prefix match is only 2–3 hours (near random for 36 classes).

2. **Timing Analysis**:
   - First CSV entry: 2025-09-28T04:00:00 UTC
   - Hours from seed start (2023-01-27): 23,404 hours
   - Hours from Unix epoch: 488,620 hours

3. **Zone Sequence** (first 20):
   ```
   18, 22, 7, 12, 26, 13, 25, 8, 22, 16, 12, 18, 11, 8, 20, 7, 29, 13, 26, 13
   ```

4. **Distribution**: Near-uniform across all 36 zones over the sample period

## Possible Explanations

### Hypothesis 1: Different Seed Version
The desecratedzones.json seed may have changed between D2R versions, or additional internal state is involved.

### Hypothesis 2: Complex State Machine
The algorithm may maintain more complex state than a simple PRNG seed, possibly involving:
- Multiple RNG states
- Zone weighting or filtering
- Exclusion lists to prevent recent repeats
- Additional configuration not present in desecratedzones.json

### Hypothesis 3: Additional Input Factors
The algorithm may incorporate:
- Player progression or character level (though unlikely for SP schedule)
- Game difficulty settings
- Additional game state not visible in the configuration files

### Hypothesis 4: Scraped Data
The CSV data from d2emu.com might have been extracted from actual game sessions rather than computed from the seed, meaning it reflects the real in-game schedule but doesn't directly expose the algorithm.

### Hypothesis 5: Proprietary Algorithm
Blizzard may be using a custom or proprietary PRNG that doesn't match common implementations.

## Next Steps for Further Investigation

1. **Extract from Game Binaries**: Reverse engineer the actual D2R executable to find the terror zone generation code

2. **Test with Other Seeds**: If possible, get desecratedzones.json from different game versions to see if the seed has changed

3. **Extended Brute Force**: Test a wider range of PRNG algorithms including:
   - PCG family variants
   - xoshiro/xoroshiro family
   - SplitMix64
   - Custom LCG with different multipliers

4. **Pattern Analysis**: Perform deeper statistical analysis:
   - Autocorrelation analysis
   - Spectral test
   - Birthday spacings test
   - Chi-square test for randomness

5. **Community Resources**: Research if the D2R modding community has documented this algorithm

## Technical Implementation

Despite not identifying the exact algorithm, we can still provide utility for D2R Arcane Tracker users:

### Option 1: Use Pre-Computed Schedule
- Import the CSV data from d2emu.com
- Store locally in the application
- Look up based on current game time

### Option 2: API Integration
- Integrate with d2emu.com's API (if available)
- Fetch real-time terror zone data

### Option 3: Manual Input
- Allow users to manually enter current terror zone
- Track and display timing for their session

## Conclusion

The terror zone scheduling algorithm used by D2R is more complex than standard PRNG implementations. While we successfully mapped the zone structure and analyzed the distribution patterns, the exact algorithm remains undetermined after testing dozens of approaches.

The most practical solution for the D2R Arcane Tracker is to utilize the pre-computed schedule data available from community resources like d2emu.com, rather than attempting to reimplement the algorithm from scratch.

---

**Analysis Date**: October 25, 2025  
**Analyst**: AI Assistant  
**Tools Used**: TypeScript, Node.js, Statistical Analysis  
**Test Count**: 30+ families/variants; thousands of parameter combos  
**Best Prefix Achieved**: 2–3 hours (near random)

