/**
 * Test bag/shuffle approaches based on pattern analysis findings
 * 
 * Key insights from analysis:
 * - Average repeat distance: ~36 (same as number of zones!)
 * - No consecutive duplicates
 * - Min repeat distance: 3
 * - Most common distances: 24-34
 * 
 * This suggests: Shuffled bag with periodic reset, but not strict exhaustion
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

// Simple LCG for testing
class SimpleLCG {
  private state: bigint;
  
  constructor(seed: bigint) {
    this.state = seed;
  }
  
  next(): number {
    const a = 6364136223846793005n;
    const c = 1442695040888963407n;
    this.state = (this.state * a + c) & 0xffffffffffffffffn;
    return Number((this.state >> 32n) & 0xffffffffn);
  }
  
  nextInRange(max: number): number {
    return this.next() % max;
  }
}

// MT19937 (32-bit)
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

interface RNG {
  nextInRange(max: number): number;
}

// Bag system with full shuffle each time
function testBagSystem(
  name: string,
  entries: Entry[],
  createRNG: (seed: number) => RNG,
  bagSize: number = 36,
  reseedStrategy: 'increment' | 'rng' = 'increment'
): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${name} (bag size: ${bagSize})`);
  console.log('='.repeat(60));
  
  const seed = 16664395743969097666n;
  let currentSeed = Number(seed & 0xffffffffn);
  let bag: number[] = [];
  let bagIndex = 0;
  let lastZone = 0;
  
  const rng = createRNG(currentSeed);
  
  function refillBag() {
    // Create new bag
    bag = Array.from({ length: bagSize }, (_, i) => (i % 36) + 1);
    
    // Fisher-Yates shuffle
    for (let i = bag.length - 1; i > 0; i--) {
      const j = rng.nextInRange(i + 1);
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    
    bagIndex = 0;
    
    if (reseedStrategy === 'increment') {
      currentSeed++;
    }
  }
  
  function getNextZone(): number {
    if (bagIndex >= bag.length) {
      refillBag();
    }
    
    const zone = bag[bagIndex++];
    
    // Skip if same as last (prevent consecutive duplicates)
    if (zone === lastZone && bagIndex < bag.length) {
      const nextZone = bag[bagIndex++];
      lastZone = nextZone;
      return nextZone;
    }
    
    lastZone = zone;
    return zone;
  }
  
  // Fast forward to the first entry
  const firstHour = entries[0].hoursSinceStart;
  for (let i = 0; i < firstHour; i++) {
    getNextZone();
  }
  
  // Test accuracy
  let matches = 0;
  const testCount = Math.min(100, entries.length);
  
  console.log('\nFirst 20 predictions:');
  for (let i = 0; i < testCount; i++) {
    const predicted = getNextZone();
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
    console.log('🎉 MATCH FOUND!');
  } else if (accuracy > 50) {
    console.log('⚠️  Partial match - refine parameters');
  }
}

function main(): void {
  console.log('D2R Terror Zone Bag/Shuffle Testing');
  console.log('='.repeat(60));
  
  const csvPath = path.join(__dirname, '..', 'terrorzone-schedule.csv');
  const entries = parseCSV(csvPath);
  
  console.log(`\nLoaded ${entries.length} schedule entries`);
  console.log(`Starting at hour ${entries[0].hoursSinceStart}`);
  
  // Test various bag configurations
  testBagSystem('MT19937 bag (size 36)', entries, (seed) => new MT19937(seed), 36, 'increment');
  testBagSystem('MT19937 bag (size 72)', entries, (seed) => new MT19937(seed), 72, 'increment');
  testBagSystem('LCG bag (size 36)', entries, (seed) => new SimpleLCG(BigInt(seed)), 36, 'increment');
  
  // Try with a different seed initialization
  console.log('\n' + '='.repeat(60));
  console.log('Testing with different starting positions...');
  console.log('='.repeat(60));
  
  // Maybe we need to start at a different position?
  for (const offset of [0, 100, 500, 1000, 5000, 10000, 20000]) {
    testBagOffsetStart('MT19937 bag', entries, offset);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('Analysis Complete');
  console.log('='.repeat(60));
}

function testBagOffsetStart(name: string, entries: Entry[], offset: number): void {
  const seed = 16664395743969097666n;
  const rng = new MT19937(Number(seed & 0xffffffffn));
  let bag: number[] = [];
  let bagIndex = 0;
  let lastZone = 0;
  
  function refillBag() {
    bag = Array.from({ length: 36 }, (_, i) => i + 1);
    for (let i = bag.length - 1; i > 0; i--) {
      const j = rng.nextInRange(i + 1);
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    bagIndex = 0;
  }
  
  function getNextZone(): number {
    if (bagIndex >= bag.length) refillBag();
    const zone = bag[bagIndex++];
    if (zone === lastZone && bagIndex < bag.length) {
      const nextZone = bag[bagIndex++];
      lastZone = nextZone;
      return nextZone;
    }
    lastZone = zone;
    return zone;
  }
  
  // Skip to offset
  for (let i = 0; i < offset; i++) {
    getNextZone();
  }
  
  let matches = 0;
  const testCount = Math.min(20, entries.length);
  
  for (let i = 0; i < testCount; i++) {
    const predicted = getNextZone();
    if (predicted === entries[i].zoneId) matches++;
  }
  
  const accuracy = (matches / testCount) * 100;
  if (accuracy > 50) {
    console.log(`  Offset ${offset.toString().padStart(6)}: ${accuracy.toFixed(1)}% (${matches}/${testCount})`);
  }
}

main();

