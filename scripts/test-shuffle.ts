/**
 * Testing Fisher-Yates shuffle with various PRNG approaches
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

function parseSchedule(csvPath: string): number[] {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').slice(1);
  
  const zoneIds: number[] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const parts = line.split(',');
    if (parts.length < 4) continue;
    
    const zone = parts[3].replace(/^"|"$/g, '').trim();
    const zoneId = ZONE_MAPPING[zone];
    
    if (zoneId) {
      zoneIds.push(zoneId);
    }
  }
  
  return zoneIds;
}

class TerrorZoneGenerator {
  private state: bigint;
  
  constructor(seed: bigint) {
    this.state = seed;
  }
  
  // 64-bit LCG
  private next(): bigint {
    const a = 6364136223846793005n;
    const c = 1442695040888963407n;
    this.state = (this.state * a + c) & ((1n << 64n) - 1n);
    return this.state;
  }
  
  // Get a random number in range [0, max)
  private nextInt(max: number): number {
    const value = this.next();
    return Number(value % BigInt(max));
  }
  
  // Generate a sequence using direct modulo (no shuffle)
  generateSequence(count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.nextInt(36) + 1);
    }
    return result;
  }
  
  // Generate using Fisher-Yates shuffle of bags
  generateWithShuffle(count: number): number[] {
    const result: number[] = [];
    let currentBag: number[] = [];
    
    for (let i = 0; i < count; i++) {
      if (currentBag.length === 0) {
        // Create new bag with all zones
        currentBag = Array.from({ length: 36 }, (_, i) => i + 1);
        
        // Fisher-Yates shuffle
        for (let j = currentBag.length - 1; j > 0; j--) {
          const k = this.nextInt(j + 1);
          [currentBag[j], currentBag[k]] = [currentBag[k], currentBag[j]];
        }
      }
      
      result.push(currentBag.pop()!);
    }
    
    return result;
  }
}

// Try MT19937 (Mersenne Twister) - common in games
class MT19937 {
  private mt: number[] = new Array(624);
  private index = 624;
  
  constructor(seed: number) {
    this.mt[0] = seed >>> 0;
    for (let i = 1; i < 624; i++) {
      const s = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((((s & 0xffff0000) >>> 16) * 1812433253) << 16) +
                   (s & 0x0000ffff) * 1812433253 + i;
      this.mt[i] >>>= 0;
    }
  }
  
  private extractNumber(): number {
    if (this.index >= 624) {
      this.twist();
    }
    
    let y = this.mt[this.index++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    
    return y >>> 0;
  }
  
  private twist(): void {
    for (let i = 0; i < 624; i++) {
      const x = (this.mt[i] & 0x80000000) + (this.mt[(i + 1) % 624] & 0x7fffffff);
      let xA = x >>> 1;
      if (x % 2 !== 0) {
        xA ^= 0x9908b0df;
      }
      this.mt[i] = this.mt[(i + 397) % 624] ^ xA;
    }
    this.index = 0;
  }
  
  nextInt(max: number): number {
    return this.extractNumber() % max;
  }
  
  generateSequence(count: number): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      result.push(this.nextInt(36) + 1);
    }
    return result;
  }
}

function compareSequences(predicted: number[], actual: number[], name: string): void {
  let matches = 0;
  const compareLength = Math.min(predicted.length, actual.length, 100);
  
  console.log(`\n=== ${name} ===`);
  
  for (let i = 0; i < compareLength; i++) {
    if (predicted[i] === actual[i]) {
      matches++;
    } else if (i < 20) {
      console.log(`  Hour ${i}: Predicted ${predicted[i]}, Actual ${actual[i]}`);
    }
  }
  
  const accuracy = (matches / compareLength) * 100;
  console.log(`Accuracy: ${accuracy.toFixed(2)}% (${matches}/${compareLength} matches)`);
  
  if (matches > 5) {
    console.log('First 50 predicted:', predicted.slice(0, 50).join(', '));
    console.log('First 50 actual:   ', actual.slice(0, 50).join(', '));
  }
}

function main() {
  const csvPath = path.join(__dirname, '..', 'terrorzone-schedule.csv');
  const actualSchedule = parseSchedule(csvPath);
  
  const seed = 16664395743969097666n;
  const startTime = '2023-01-27T00:00:00+00:00';
  const firstScheduleTime = '2025-09-28T04:00:00+00:00';
  
  // Calculate offset
  const start = new Date(startTime);
  const first = new Date(firstScheduleTime);
  const hoursOffset = Math.floor((first.getTime() - start.getTime()) / (1000 * 60 * 60));
  
  console.log(`Hours offset from seed start: ${hoursOffset}`);
  console.log(`Testing against ${actualSchedule.length} zones\n`);
  
  // Test 1: Direct LCG approach with offset
  console.log('=== Test 1: LCG Direct (with offset) ===');
  const gen1 = new TerrorZoneGenerator(seed);
  const warmup = gen1.generateSequence(hoursOffset);
  const predicted1 = gen1.generateSequence(actualSchedule.length);
  compareSequences(predicted1, actualSchedule, 'LCG Direct');
  
  // Test 2: LCG with Fisher-Yates shuffle
  console.log('\n=== Test 2: LCG with Shuffle ===');
  const gen2 = new TerrorZoneGenerator(seed);
  gen2.generateSequence(hoursOffset); // Skip to offset
  const predicted2 = gen2.generateWithShuffle(actualSchedule.length);
  compareSequences(predicted2, actualSchedule, 'LCG with Shuffle');
  
  // Test 3: Mersenne Twister
  console.log('\n=== Test 3: Mersenne Twister ===');
  const mt = new MT19937(Number(seed & 0xFFFFFFFFn));
  // Skip to offset
  for (let i = 0; i < hoursOffset; i++) {
    mt.nextInt(36);
  }
  const predicted3 = mt.generateSequence(actualSchedule.length);
  compareSequences(predicted3, actualSchedule, 'MT19937');
  
  // Test 4: Try without offset (maybe the seed already accounts for it)
  console.log('\n=== Test 4: LCG Direct (no offset) ===');
  const gen4 = new TerrorZoneGenerator(seed);
  const predicted4 = gen4.generateSequence(actualSchedule.length);
  compareSequences(predicted4, actualSchedule, 'LCG Direct (no offset)');
  
  // Test 5: Maybe the seed IS the hour timestamp?
  const scheduleTimestamp = Math.floor(first.getTime() / (1000 * 60 * 60));
  console.log(`\n=== Test 5: Using schedule timestamp as seed ===`);
  console.log(`Schedule timestamp (hours since epoch): ${scheduleTimestamp}`);
  const gen5 = new TerrorZoneGenerator(BigInt(scheduleTimestamp));
  const predicted5 = gen5.generateSequence(actualSchedule.length);
  compareSequences(predicted5, actualSchedule, 'Timestamp as seed');
}

main();

