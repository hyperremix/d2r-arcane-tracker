/**
 * Testing if the algorithm combines the seed with the hour/time
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ZONE_MAPPING: Record<string, number> = {
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
  "Worldstone Keep, Throne of Destruction, Worldstone Chamber": 36
};

interface ScheduleEntry {
  timestamp: string;
  zone: string;
  zoneId: number;
}

function parseSchedule(csvPath: string): ScheduleEntry[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').slice(1);
  
  const schedule: ScheduleEntry[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const parts = line.split(',');
    if (parts.length < 4) continue;
    
    const timestamp = parts[2];
    const zone = parts[3].replace(/^"|"$/g, '').trim();
    const zoneId = ZONE_MAPPING[zone];
    
    if (zoneId) {
      schedule.push({ timestamp, zone, zoneId });
    }
  }
  
  return schedule;
}

// Hash-based approach: combine seed with hour
function hashApproach(seed: bigint, hour: bigint): number {
  const combined = seed + hour;
  const a = 6364136223846793005n;
  const c = 1442695040888963407n;
  const hashed = (combined * a + c) & ((1n << 64n) - 1n);
  return Number(hashed % 36n) + 1;
}

// Multiply approach
function multiplyApproach(seed: bigint, hour: bigint): number {
  const combined = seed * (hour + 1n);
  const a = 6364136223846793005n;
  const hashed = (combined * a) & ((1n << 64n) - 1n);
  return Number(hashed % 36n) + 1;
}

// XOR approach
function xorApproach(seed: bigint, hour: bigint): number {
  const combined = seed ^ (hour * 0x123456789ABCDEFn);
  const a = 6364136223846793005n;
  const c = 1442695040888963407n;
  const hashed = (combined * a + c) & ((1n << 64n) - 1n);
  return Number(hashed % 36n) + 1;
}

// PCG-like approach
function pcgApproach(seed: bigint, hour: bigint): number {
  const state = seed + hour;
  const word = ((state >> ((state >> 59n) + 5n)) ^ state) * 12605985483714917081n;
  return Number((word >> 43n) % 36n) + 1;
}

// Java Random with combined seed
function javaRandomApproach(seed: bigint, hour: bigint): number {
  let s = (seed + hour) & ((1n << 48n) - 1n);
  s = (s * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
  return Number((s >> 17n) % 36n) + 1;
}

function testApproach(
  name: string,
  schedule: ScheduleEntry[],
  seed: bigint,
  startTime: string,
  approach: (seed: bigint, hour: bigint) => number
): void {
  console.log(`\n=== ${name} ===`);
  
  const start = new Date(startTime);
  let matches = 0;
  const testCount = Math.min(100, schedule.length);
  
  for (let i = 0; i < testCount; i++) {
    const entry = schedule[i];
    const entryTime = new Date(entry.timestamp);
    const hoursSinceStart = BigInt(Math.floor((entryTime.getTime() - start.getTime()) / (1000 * 60 * 60)));
    
    const predicted = approach(seed, hoursSinceStart);
    const actual = entry.zoneId;
    
    if (predicted === actual) {
      matches++;
    } else if (i < 10) {
      console.log(`  Hour ${i} (offset ${hoursSinceStart}): Predicted ${predicted}, Actual ${actual}`);
    }
  }
  
  const accuracy = (matches / testCount) * 100;
  console.log(`Accuracy: ${accuracy.toFixed(2)}% (${matches}/${testCount} matches)`);
}

// Try reverse engineering from a known pair
function bruteForceSmallSearch(schedule: ScheduleEntry[], seed: bigint, startTime: string): void {
  console.log('\n=== Brute Force Small Search ===');
  console.log('Testing variations of the seed and formulas...\n');
  
  const start = new Date(startTime);
  const firstEntry = schedule[0];
  const firstTime = new Date(firstEntry.timestamp);
  const hoursOffset = BigInt(Math.floor((firstTime.getTime() - start.getTime()) / (1000 * 60 * 60)));
  
  console.log(`First entry: Zone ${firstEntry.zoneId} at hour offset ${hoursOffset}`);
  console.log(`Looking for formulas that produce zone ${firstEntry.zoneId}...\n`);
  
  // Try different multipliers with the seed
  const testMultipliers = [
    1n, 2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n,
    6364136223846793005n, // LCG multiplier
    1103515245n, // Common LCG multiplier
    48271n, // MINSTD
  ];
  
  for (const mult of testMultipliers) {
    const value = (seed * mult + hoursOffset) & ((1n << 64n) - 1n);
    const zone = Number(value % 36n) + 1;
    if (zone === firstEntry.zoneId) {
      console.log(`  MATCH! Multiplier: ${mult}, Formula: (seed * ${mult} + hour) % 36 + 1`);
      
      // Test this formula on more entries
      let matches = 0;
      for (let i = 0; i < Math.min(100, schedule.length); i++) {
        const entry = schedule[i];
        const entryTime = new Date(entry.timestamp);
        const h = BigInt(Math.floor((entryTime.getTime() - start.getTime()) / (1000 * 60 * 60)));
        const v = (seed * mult + h) & ((1n << 64n) - 1n);
        const z = Number(v % 36n) + 1;
        if (z === entry.zoneId) matches++;
      }
      console.log(`     Extended test: ${matches}/100 matches\n`);
    }
  }
}

function main() {
  const csvPath = path.join(__dirname, '..', 'terrorzone-schedule.csv');
  const schedule = parseSchedule(csvPath);
  
  const seed = 16664395743969097666n;
  const startTime = '2023-01-27T00:00:00+00:00';
  
  console.log('=== Testing Combined Seed+Time Approaches ===');
  console.log(`Seed: ${seed}`);
  console.log(`Start time: ${startTime}`);
  console.log(`Schedule entries: ${schedule.length}\n`);
  
  testApproach('Hash (seed + hour)', schedule, seed, startTime, hashApproach);
  testApproach('Multiply (seed * hour)', schedule, seed, startTime, multiplyApproach);
  testApproach('XOR (seed ^ hour)', schedule, seed, startTime, xorApproach);
  testApproach('PCG-like', schedule, seed, startTime, pcgApproach);
  testApproach('Java Random-like', schedule, seed, startTime, javaRandomApproach);
  
  bruteForceSmallSearch(schedule, seed, startTime);
}

main();

