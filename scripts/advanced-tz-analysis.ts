/**
 * Advanced D2R Terror Zone Algorithm Analysis
 * 
 * New approaches based on observations:
 * 1. Web trackers say schedule is predictable and global
 * 2. Zones repeat every 10-12 hours (not 36-hour cycles)
 * 3. Maybe it's a periodic shuffle/bag system
 * 4. Try common game RNG implementations (C++ std::mt19937, boost::random, etc.)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ZONE_NAMES: Record<string, number> = {
  "Burial Grounds, Crypt, Mausoleum": 1,
  "Cathedral, Catacombs": 2,
  "Cold Plains, Cave": 3,
  "Dark Wood, Underground Passage": 4,
  "Blood Moor, Den of Evil": 5,
  "Barracks, Jail": 6,
  "The Secret Cow Level": 7,
  "Stony Field": 8,
  "Black Marsh, The Hole": 9,
  "Forgotten Tower": 10,
  "Pit": 11,
  "Tristram": 12,
  "Lut Gholein Sewers": 13,
  "Rocky Waste, Stony Tomb": 14,
  "Dry Hills, Halls of the Dead": 15,
  "Far Oasis": 16,
  "Lost City, Valley of Snakes, Claw Viper Temple": 17,
  "Ancient Tunnels": 18,
  "Tal Rasha's Tombs, Tal Rasha's Chamber": 19,
  "Arcane Sanctuary": 20,
  "Spider Forest, Spider Cavern": 21,
  "Great Marsh": 22,
  "Flayer Jungle, Flayer Dungeon": 23,
  "Kurast Bazaar, Ruined Temple, Disused Fane": 24,
  "Travincal": 25,
  "Durance of Hate": 26,
  "Outer Steppes, Plains of Despair": 27,
  "City of the Damned, River of Flame": 28,
  "Chaos Sanctuary": 29,
  "Bloody Foothills, Frigid Highlands, Abaddon": 30,
  "Arreat Plateau, Pit of Acheron": 31,
  "Crystalline Passage, Frozen River": 32,
  "Nihlathak's Temple, Temple Halls": 33,
  "Glacial Trail, Drifter Cavern": 34,
  "Ancient's Way, Icy Cellar": 35,
  "Worldstone Keep, Throne of Destruction, Worldstone Chamber": 36,
};

interface Entry {
  timestamp: Date;
  zoneId: number;
  hoursSinceStart: number;
}

function parseCSV(csvPath: string): Entry[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.trim().split('\n').slice(1);
  const startTime = new Date('2023-01-27T00:00:00Z');
  
  const entries: Entry[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const match = line.match(/^[^,]+,[^,]+,([^,]+),"?([^"]+)"?$/);
    if (!match) continue;
    
    const [, isoTime, zoneName] = match;
    const zoneId = ZONE_NAMES[zoneName];
    if (!zoneId) continue;
    
    const timestamp = new Date(isoTime);
    const hoursSinceStart = Math.floor((timestamp.getTime() - startTime.getTime()) / (1000 * 60 * 60));
    
    entries.push({ timestamp, zoneId, hoursSinceStart });
  }
  
  return entries;
}

// Mersenne Twister MT19937 (32-bit version - more common in games)
class MT19937 {
  private readonly N = 624;
  private readonly M = 397;
  private readonly MATRIX_A = 0x9908b0df;
  private readonly UPPER_MASK = 0x80000000;
  private readonly LOWER_MASK = 0x7fffffff;
  
  private mt: number[] = new Array(this.N);
  private mti = this.N + 1;
  
  constructor(seed: number) {
    this.init(seed);
  }
  
  private init(seed: number): void {
    this.mt[0] = seed >>> 0;
    for (this.mti = 1; this.mti < this.N; this.mti++) {
      const s = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) + (s & 0x0000ffff) * 1812433253 + this.mti) >>> 0;
    }
  }
  
  next(): number {
    let y: number;
    const mag01 = [0, this.MATRIX_A];
    
    if (this.mti >= this.N) {
      let kk: number;
      
      for (kk = 0; kk < this.N - this.M; kk++) {
        y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
        this.mt[kk] = this.mt[kk + this.M] ^ (y >>> 1) ^ mag01[y & 0x1];
      }
      for (; kk < this.N - 1; kk++) {
        y = (this.mt[kk] & this.UPPER_MASK) | (this.mt[kk + 1] & this.LOWER_MASK);
        this.mt[kk] = this.mt[kk + (this.M - this.N)] ^ (y >>> 1) ^ mag01[y & 0x1];
      }
      y = (this.mt[this.N - 1] & this.UPPER_MASK) | (this.mt[0] & this.LOWER_MASK);
      this.mt[this.N - 1] = this.mt[this.M - 1] ^ (y >>> 1) ^ mag01[y & 0x1];
      
      this.mti = 0;
    }
    
    y = this.mt[this.mti++];
    
    y ^= (y >>> 11);
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= (y >>> 18);
    
    return y >>> 0;
  }
  
  nextInRange(max: number): number {
    return this.next() % max;
  }
}

// SplitMix64 (often used to seed other RNGs)
class SplitMix64 {
  private state: bigint;
  
  constructor(seed: bigint) {
    this.state = seed;
  }
  
  next(): bigint {
    this.state = (this.state + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = this.state;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    return z ^ (z >> 31n);
  }
  
  nextInRange(max: number): number {
    return Number(this.next() % BigInt(max));
  }
}

// PCG32 (Permuted Congruential Generator)
class PCG32 {
  private state: bigint;
  private readonly inc: bigint;
  
  constructor(seed: bigint, seq: bigint = 1n) {
    this.inc = (seq << 1n) | 1n;
    this.state = 0n;
    this.next();
    this.state = (this.state + seed) & 0xffffffffffffffffn;
    this.next();
  }
  
  next(): number {
    const oldState = this.state;
    this.state = ((oldState * 6364136223846793005n) + this.inc) & 0xffffffffffffffffn;
    const xorShifted = Number(((oldState >> 18n) ^ oldState) >> 27n);
    const rot = Number(oldState >> 59n);
    return ((xorShifted >>> rot) | (xorShifted << ((-rot) & 31))) >>> 0;
  }
  
  nextInRange(max: number): number {
    return this.next() % max;
  }
}

// Xoshiro256++ (modern, fast PRNG)
class Xoshiro256PlusPlus {
  private s: bigint[] = [0n, 0n, 0n, 0n];
  
  constructor(seed: bigint) {
    // Use SplitMix64 to initialize state
    const sm = new SplitMix64(seed);
    for (let i = 0; i < 4; i++) {
      this.s[i] = sm.next();
    }
  }
  
  private rotl(x: bigint, k: number): bigint {
    return ((x << BigInt(k)) | (x >> BigInt(64 - k))) & 0xffffffffffffffffn;
  }
  
  next(): bigint {
    const result = (this.rotl(this.s[0] + this.s[3], 23) + this.s[0]) & 0xffffffffffffffffn;
    const t = (this.s[1] << 17n) & 0xffffffffffffffffn;
    
    this.s[2] ^= this.s[0];
    this.s[3] ^= this.s[1];
    this.s[1] ^= this.s[2];
    this.s[0] ^= this.s[3];
    
    this.s[2] ^= t;
    this.s[3] = this.rotl(this.s[3], 45);
    
    return result;
  }
  
  nextInRange(max: number): number {
    return Number(this.next() % BigInt(max));
  }
}

// Try hashing approaches (seed combined with hour)
function hashCombine(seed: bigint, hour: bigint): number {
  // FNV-1a hash
  let hash = 2166136261n;
  const data = seed ^ hour;
  
  for (let i = 0; i < 8; i++) {
    hash ^= (data >> BigInt(i * 8)) & 0xffn;
    hash = (hash * 16777619n) & 0xffffffffn;
  }
  
  return Number(hash % 36n) + 1;
}

function testAlgorithm(
  name: string,
  entries: Entry[],
  generateZone: (hour: number) => number
): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name}`);
  console.log('='.repeat(60));
  
  let matches = 0;
  const testCount = Math.min(100, entries.length);
  
  console.log('\nFirst 20 predictions:');
  for (let i = 0; i < testCount; i++) {
    const predicted = generateZone(entries[i].hoursSinceStart);
    const actual = entries[i].zoneId;
    
    if (i < 20) {
      const status = predicted === actual ? '✓' : '✗';
      console.log(`  ${i}: Pred=${predicted.toString().padStart(2)}, Actual=${actual.toString().padStart(2)} ${status}`);
    }
    
    if (predicted === actual) matches++;
  }
  
  const accuracy = (matches / testCount) * 100;
  console.log(`\nAccuracy: ${accuracy.toFixed(2)}% (${matches}/${testCount})`);
  
  if (accuracy > 90) {
    console.log('🎉 LIKELY MATCH FOUND!');
  } else if (accuracy > 50) {
    console.log('⚠️  Partial match - needs refinement');
  }
}

// Test periodic shuffle approach
function testPeriodicShuffle(entries: Entry[], seed: bigint, periodHours: number): void {
  const name = `Periodic Shuffle (every ${periodHours} hours)`;
  
  testAlgorithm(name, entries, (hour: number) => {
    const period = Math.floor(hour / periodHours);
    const rng = new MT19937(Number((seed + BigInt(period)) & 0xffffffffn));
    
    // Create and shuffle a bag
    const zones = Array.from({ length: 36 }, (_, i) => i + 1);
    for (let i = zones.length - 1; i > 0; i--) {
      const j = rng.nextInRange(i + 1);
      [zones[i], zones[j]] = [zones[j], zones[i]];
    }
    
    const posInPeriod = hour % periodHours;
    return zones[posInPeriod % 36];
  });
}

function main(): void {
  console.log('D2R Terror Zone Advanced Analysis');
  console.log('=' .repeat(60));
  console.log();
  
  const csvPath = path.join(__dirname, '..', 'terrorzone-schedule.csv');
  const entries = parseCSV(csvPath);
  
  console.log(`Loaded ${entries.length} schedule entries`);
  console.log(`Date range: ${entries[0].timestamp.toISOString()} to ${entries[entries.length - 1].timestamp.toISOString()}`);
  console.log(`Hour range: ${entries[0].hoursSinceStart} to ${entries[entries.length - 1].hoursSinceStart}`);
  console.log();
  console.log('First 10 zones:', entries.slice(0, 10).map(e => e.zoneId).join(', '));
  
  const seed = 16664395743969097666n;
  
  // Test 1: Direct MT19937 with different initialization strategies
  testAlgorithm('MT19937 (low 32 bits of seed)', entries, (hour) => {
    const rng = new MT19937(Number(seed & 0xffffffffn));
    for (let i = 0; i < hour; i++) rng.next();
    return (rng.next() % 36) + 1;
  });
  
  testAlgorithm('MT19937 (high 32 bits of seed)', entries, (hour) => {
    const rng = new MT19937(Number((seed >> 32n) & 0xffffffffn));
    for (let i = 0; i < hour; i++) rng.next();
    return (rng.next() % 36) + 1;
  });
  
  // Test 2: SplitMix64
  testAlgorithm('SplitMix64', entries, (hour) => {
    const rng = new SplitMix64(seed);
    for (let i = 0; i < hour; i++) rng.next();
    return rng.nextInRange(36) + 1;
  });
  
  // Test 3: PCG32
  testAlgorithm('PCG32', entries, (hour) => {
    const rng = new PCG32(seed);
    for (let i = 0; i < hour; i++) rng.next();
    return (rng.next() % 36) + 1;
  });
  
  // Test 4: Xoshiro256++
  testAlgorithm('Xoshiro256++', entries, (hour) => {
    const rng = new Xoshiro256PlusPlus(seed);
    for (let i = 0; i < hour; i++) rng.next();
    return rng.nextInRange(36) + 1;
  });
  
  // Test 5: Hash-based (seed combined with hour)
  testAlgorithm('Hash-based (FNV-1a)', entries, (hour) => {
    return hashCombine(seed, BigInt(hour));
  });
  
  // Test 6: Periodic shuffle with different periods
  for (const period of [36, 72, 100, 144, 200, 288]) {
    testPeriodicShuffle(entries, seed, period);
  }
  
  // Test 7: MT19937 with seed XOR hour
  testAlgorithm('MT19937 (seed XOR hour)', entries, (hour) => {
    const combinedSeed = Number((seed ^ BigInt(hour)) & 0xffffffffn);
    const rng = new MT19937(combinedSeed);
    return (rng.next() % 36) + 1;
  });
  
  // Test 8: Directhour as seed (maybe schedule is pre-computed?)
  testAlgorithm('MT19937 (hour as seed)', entries, (hour) => {
    const rng = new MT19937(hour);
    return (rng.next() % 36) + 1;
  });
  
  console.log('\n' + '='.repeat(60));
  console.log('Analysis Complete');
  console.log('='.repeat(60));
}

main();

