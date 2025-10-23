/**
 * Detailed analysis of the schedule timing and zone sequence
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
  rawLine: string;
  date: string;
  time: string;
  timestamp: string;
  zone: string;
  zoneId: number;
  hoursFromEpoch: number;
  hoursFromStart: number;
}

function parseSchedule(csvPath: string, startTime: string): ScheduleEntry[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n');
  
  const schedule: ScheduleEntry[] = [];
  const start = new Date(startTime);
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const parts = line.split(',');
    if (parts.length < 4) continue;
    
    const date = parts[0];
    const time = parts[1];
    const timestamp = parts[2];
    const zone = parts[3].replace(/^"|"$/g, '').trim();
    const zoneId = ZONE_MAPPING[zone];
    
    if (zoneId && timestamp) {
      const entryTime = new Date(timestamp);
      const hoursFromEpoch = Math.floor(entryTime.getTime() / (1000 * 60 * 60));
      const hoursFromStart = Math.floor((entryTime.getTime() - start.getTime()) / (1000 * 60 * 60));
      
      schedule.push({
        rawLine: line,
        date,
        time,
        timestamp,
        zone,
        zoneId,
        hoursFromEpoch,
        hoursFromStart
      });
    }
  }
  
  return schedule;
}

// Try the "hour from epoch" approach - maybe that's the actual input
function testEpochHour(schedule: ScheduleEntry[], seed: bigint): void {
  console.log('\n=== Test: Using Hours from Unix Epoch ===\n');
  
  // First entry details
  const first = schedule[0];
  console.log(`First entry:`);
  console.log(`  Time: ${first.timestamp}`);
  console.log(`  Zone: ${first.zone} (ID: ${first.zoneId})`);
  console.log(`  Hours from epoch: ${first.hoursFromEpoch}`);
  console.log(`  Hours from start (2023-01-27): ${first.hoursFromStart}`);
  
  // Try using epoch hours directly with seed
  console.log(`\nTrying: (seed + epochHour) -> LCG -> % 36 + 1`);
  
  let matches = 0;
  for (let i = 0; i < Math.min(20, schedule.length); i++) {
    const entry = schedule[i];
    const hourSeed = seed + BigInt(entry.hoursFromEpoch);
    const a = 6364136223846793005n;
    const c = 1442695040888963407n;
    const value = (hourSeed * a + c) & ((1n << 64n) - 1n);
    const predicted = Number(value % 36n) + 1;
    
    const match = predicted === entry.zoneId;
    if (match) matches++;
    
    console.log(`  Hour ${entry.hoursFromEpoch}: Predicted ${predicted}, Actual ${entry.zoneId} ${match ? '✓' : '✗'}`);
  }
  
  console.log(`\nMatches: ${matches}/20`);
}

// Maybe the seed needs to be XORed or combined differently with time
function testVariations(schedule: ScheduleEntry[], seed: bigint): void {
  console.log('\n=== Testing Variations with Hours from Start ===\n');
  
  const testCases = [
    {
      name: "seed ^ hoursFromStart",
      fn: (h: number) => {
        const combined = seed ^ BigInt(h);
        return Number(combined % 36n) + 1;
      }
    },
    {
      name: "(seed + hoursFromStart * multiplier) % 36",
      fn: (h: number) => {
        const combined = seed + BigInt(h) * 123456789n;
        return Number(combined % 36n) + 1;
      }
    },
    {
      name: "Java Random style with hoursFromStart",
      fn: (h: number) => {
        let s = (seed ^ BigInt(h)) & ((1n << 48n) - 1n);
        s = (s * 0x5DEECE66Dn + 0xBn) & ((1n << 48n) - 1n);
        const result = Number(s >> 16n);
        return (result % 36) + 1;
      }
    },
  ];
  
  for (const test of testCases) {
    let matches = 0;
    for (let i = 0; i < Math.min(100, schedule.length); i++) {
      const entry = schedule[i];
      const predicted = test.fn(entry.hoursFromStart);
      if (predicted === entry.zoneId) matches++;
    }
    console.log(`${test.name}: ${matches}/100 matches`);
  }
}

// Check if there's a simpler pattern - maybe just reading from a pre-shuffled list?
function checkForPreShuffled(schedule: ScheduleEntry[]): void {
  console.log('\n=== Checking for Pre-Shuffled Pattern ===\n');
  
  // See if the sequence repeats at some interval
  for (const windowSize of [36, 72, 100, 200, 300]) {
    if (schedule.length < windowSize * 2) continue;
    
    let repeating = true;
    for (let i = 0; i < Math.min(50, schedule.length - windowSize); i++) {
      if (schedule[i].zoneId !== schedule[i + windowSize].zoneId) {
        repeating = false;
        break;
      }
    }
    
    if (repeating) {
      console.log(`✓ Pattern repeats every ${windowSize} entries!`);
      console.log(`  This suggests a fixed shuffled list of ${windowSize} zones.\n`);
      return;
    }
  }
  
  console.log('No simple repeating pattern found in tested window sizes.\n');
}

function main() {
  const csvPath = path.join(__dirname, '..', 'terrorzone-schedule.csv');
  const startTime = '2023-01-27T00:00:00+00:00';
  const seed = 16664395743969097666n;
  
  const schedule = parseSchedule(csvPath, startTime);
  
  console.log('=== Detailed Terror Zone Schedule Analysis ===');
  console.log(`\nSeed: ${seed}`);
  console.log(`Start time: ${startTime}`);
  console.log(`Schedule entries: ${schedule.length}`);
  
  // Show raw data for first few entries
  console.log(`\nFirst 5 entries (raw data):`);
  for (let i = 0; i < Math.min(5, schedule.length); i++) {
    const e = schedule[i];
    console.log(`  ${i}: ${e.timestamp} -> Zone ${e.zoneId} (${e.zone})`);
    console.log(`     Hours from epoch: ${e.hoursFromEpoch}, Hours from start: ${e.hoursFromStart}`);
  }
  
  testEpochHour(schedule, seed);
  testVariations(schedule, seed);
  checkForPreShuffled(schedule);
  
  // One more thing - maybe the CSV is from a different source/calculation?
  console.log('\n=== Alternative Theory ===');
  console.log('The CSV might have been generated with a different seed or');
  console.log('different version of the game. The desecratedzones.json seed');
  console.log('might have changed between versions.\n');
}

main();

