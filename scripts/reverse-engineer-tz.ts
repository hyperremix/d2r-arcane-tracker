/**
 * Reverse engineer the D2R single player terror zone algorithm
 * 
 * Analysis approach:
 * 1. Parse the zone mappings from desecratedzones.json
 * 2. Parse the known schedule from terrorzone-schedule.csv
 * 3. Identify the PRNG algorithm by testing common patterns
 * 4. Validate against the known schedule
 */

import fs from 'fs';
import path from 'path';

// Zone name to ID mapping
const ZONE_NAME_TO_ID: Record<string, number> = {
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

// ID to name mapping (with aliases)
const ID_TO_ZONE_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(ZONE_NAME_TO_ID).map(([name, id]) => [id, name])
);

interface ScheduleEntry {
  date: string;
  time: string;
  dateTimeISO: string;
  zoneName: string;
  zoneId: number;
  hoursSinceEpoch: number;
}

// Parse the CSV schedule
function parseSchedule(csvPath: string): ScheduleEntry[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').slice(1); // Skip header
  
  const entries: ScheduleEntry[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const parts = line.split(',');
    if (parts.length < 4) continue;
    
    const date = parts[0];
    const time = parts[1];
    const dateTimeISO = parts[2];
    const zoneName = parts[3].replace(/^"/, '').replace(/"$/, '');
    
    const zoneId = ZONE_NAME_TO_ID[zoneName];
    if (!zoneId) {
      console.warn(`Unknown zone: ${zoneName}`);
      continue;
    }
    
    const timestamp = new Date(dateTimeISO);
    const hoursSinceEpoch = Math.floor(timestamp.getTime() / (1000 * 60 * 60));
    
    entries.push({
      date,
      time,
      dateTimeISO,
      zoneName,
      zoneId,
      hoursSinceEpoch,
    });
  }
  
  return entries;
}

// Test different PRNG algorithms
class LCG {
  private state: bigint;
  
  constructor(seed: bigint) {
    this.state = seed;
  }
  
  // Standard MINSTD parameters
  next(): number {
    const a = 48271n;
    const m = 2147483647n; // 2^31 - 1
    this.state = (a * this.state) % m;
    return Number(this.state);
  }
  
  nextInRange(max: number): number {
    return this.next() % max;
  }
}

class LCG64 {
  private state: bigint;
  
  constructor(seed: bigint) {
    this.state = seed;
  }
  
  // 64-bit LCG with common parameters
  next(): bigint {
    const a = 6364136223846793005n;
    const c = 1442695040888963407n;
    const m = 2n ** 64n;
    this.state = (a * this.state + c) % m;
    return this.state;
  }
  
  nextInRange(max: number): number {
    return Number(this.next() % BigInt(max));
  }
}

class XorShift64 {
  private state: bigint;
  
  constructor(seed: bigint) {
    this.state = seed || 1n; // Avoid zero state
  }
  
  next(): bigint {
    let x = this.state;
    x ^= x << 13n;
    x ^= x >> 7n;
    x ^= x << 17n;
    this.state = x;
    return x;
  }
  
  nextInRange(max: number): number {
    const val = this.next();
    return Number((val < 0n ? -val : val) % BigInt(max));
  }
}

// Analyze the schedule to find patterns
function analyzeSchedule(entries: ScheduleEntry[]): void {
  console.log('=== Schedule Analysis ===\n');
  console.log(`Total entries: ${entries.length}`);
  console.log(`First entry: ${entries[0].dateTimeISO} - ${entries[0].zoneName}`);
  console.log(`Last entry: ${entries[entries.length - 1]?.dateTimeISO} - ${entries[entries.length - 1]?.zoneName}`);
  
  // Count zone frequencies
  const zoneCounts: Record<number, number> = {};
  for (const entry of entries) {
    zoneCounts[entry.zoneId] = (zoneCounts[entry.zoneId] || 0) + 1;
  }
  
  console.log('\n=== Zone Frequencies ===');
  const sortedZones = Object.entries(zoneCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  
  for (const [zoneId, count] of sortedZones) {
    console.log(`Zone ${zoneId} (${ID_TO_ZONE_NAME[Number(zoneId)]}): ${count} times`);
  }
  
  // Look for repeating patterns
  console.log('\n=== First 20 Zone IDs ===');
  console.log(entries.slice(0, 20).map(e => e.zoneId).join(', '));
}

// Test if a PRNG matches the schedule
function testPRNG(
  name: string,
  seed: bigint,
  startTime: Date,
  entries: ScheduleEntry[],
  createPRNG: (seed: bigint) => { nextInRange: (max: number) => number }
): boolean {
  console.log(`\n=== Testing ${name} ===`);
  
  const prng = createPRNG(seed);
  
  // Calculate hours between start time and first entry
  const startHour = Math.floor(startTime.getTime() / (1000 * 60 * 60));
  const firstEntryHour = entries[0].hoursSinceEpoch;
  const hourOffset = firstEntryHour - startHour;
  
  console.log(`Start time: ${startTime.toISOString()}`);
  console.log(`First entry: ${entries[0].dateTimeISO}`);
  console.log(`Hour offset: ${hourOffset}`);
  
  // Advance PRNG to the first entry
  for (let i = 0; i < hourOffset; i++) {
    prng.nextInRange(36);
  }
  
  // Test against known schedule
  let matches = 0;
  const testCount = Math.min(100, entries.length);
  
  console.log('\nFirst 20 predictions vs actual:');
  for (let i = 0; i < testCount; i++) {
    const predictedId = prng.nextInRange(36) + 1; // Zone IDs are 1-based
    const actualId = entries[i].zoneId;
    
    if (i < 20) {
      console.log(`Hour ${i}: Predicted=${predictedId}, Actual=${actualId}, ${predictedId === actualId ? '✓' : '✗'}`);
    }
    
    if (predictedId === actualId) {
      matches++;
    }
  }
  
  const accuracy = (matches / testCount) * 100;
  console.log(`\nAccuracy: ${accuracy.toFixed(2)}% (${matches}/${testCount})`);
  
  return accuracy > 90;
}

// Main analysis
function main() {
  const csvPath = path.join(__dirname, '..', 'terrorzone-schedule.csv');
  const jsonPath = path.join(__dirname, '..', 'desecratedzones.json');
  
  console.log('D2R Terror Zone Schedule Reverse Engineering\n');
  console.log('=' .repeat(60));
  
  // Parse schedule
  const entries = parseSchedule(csvPath);
  
  // Analyze patterns
  analyzeSchedule(entries);
  
  // Configuration from desecratedzones.json
  const seed = 16664395743969097666n;
  const startTime = new Date('2023-01-27T00:00:00Z');
  
  console.log('\n' + '='.repeat(60));
  console.log('Testing PRNG Algorithms');
  console.log('='.repeat(60));
  
  // Test different PRNG implementations
  const algorithms = [
    {
      name: 'LCG (32-bit MINSTD)',
      create: (s: bigint) => new LCG(s),
    },
    {
      name: 'LCG (64-bit)',
      create: (s: bigint) => new LCG64(s),
    },
    {
      name: 'XorShift64',
      create: (s: bigint) => new XorShift64(s),
    },
  ];
  
  for (const algo of algorithms) {
    const success = testPRNG(algo.name, seed, startTime, entries, algo.create);
    if (success) {
      console.log(`\n🎉 Found matching algorithm: ${algo.name}`);
      break;
    }
  }
}

main();
