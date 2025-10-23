/**
 * Pattern Analysis for Terror Zone Schedule
 * Checking if zones are shuffled in complete cycles
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

function findCycles(zoneIds: number[]): void {
  console.log('=== Analyzing for Shuffle Cycles ===\n');
  
  let currentCycle: number[] = [];
  let cycles: number[][] = [];
  let seenInCycle = new Set<number>();
  
  for (let i = 0; i < zoneIds.length; i++) {
    const zoneId = zoneIds[i];
    
    if (seenInCycle.has(zoneId)) {
      // Zone repeats - possible new cycle
      cycles.push([...currentCycle]);
      currentCycle = [zoneId];
      seenInCycle = new Set([zoneId]);
    } else {
      currentCycle.push(zoneId);
      seenInCycle.add(zoneId);
    }
    
    // Check if we've seen all 36 zones
    if (seenInCycle.size === 36) {
      cycles.push([...currentCycle]);
      currentCycle = [];
      seenInCycle = new Set();
    }
  }
  
  if (currentCycle.length > 0) {
    cycles.push(currentCycle);
  }
  
  console.log(`Found ${cycles.length} potential cycles\n`);
  
  for (let i = 0; i < Math.min(5, cycles.length); i++) {
    console.log(`Cycle ${i + 1}: ${cycles[i].length} zones`);
    if (cycles[i].length <= 40) {
      console.log(`  Zones: ${cycles[i].join(', ')}`);
    }
    console.log(`  Unique zones: ${new Set(cycles[i]).size}`);
  }
}

function analyzeRepeats(zoneIds: number[]): void {
  console.log('\n=== Analyzing Consecutive Repeats ===\n');
  
  let consecutiveRepeats = 0;
  for (let i = 1; i < zoneIds.length; i++) {
    if (zoneIds[i] === zoneIds[i - 1]) {
      consecutiveRepeats++;
      console.log(`  Repeat at position ${i}: Zone ${zoneIds[i]}`);
    }
  }
  
  console.log(`\nTotal consecutive repeats: ${consecutiveRepeats}`);
}

function analyzeDistances(zoneIds: number[]): void {
  console.log('\n=== Analyzing Repeat Distances ===\n');
  
  const lastSeen = new Map<number, number>();
  const distances = new Map<number, number[]>();
  
  for (let i = 0; i < zoneIds.length; i++) {
    const zoneId = zoneIds[i];
    
    if (lastSeen.has(zoneId)) {
      const distance = i - lastSeen.get(zoneId)!;
      if (!distances.has(zoneId)) {
        distances.set(zoneId, []);
      }
      distances.get(zoneId)!.push(distance);
    }
    
    lastSeen.set(zoneId, i);
  }
  
  // Analyze common distances
  const allDistances: number[] = [];
  for (const dists of distances.values()) {
    allDistances.push(...dists);
  }
  
  const distanceCounts = new Map<number, number>();
  for (const dist of allDistances) {
    distanceCounts.set(dist, (distanceCounts.get(dist) || 0) + 1);
  }
  
  console.log('Most common repeat distances:');
  Array.from(distanceCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([dist, count]) => {
      console.log(`  Distance ${dist}: ${count} times`);
    });
  
  // Check if 36 is a common distance (would indicate simple shuffle)
  if (distanceCounts.has(36)) {
    console.log(`\n*** Distance 36 appears ${distanceCounts.get(36)} times - this suggests a 36-zone shuffle cycle! ***`);
  }
}

function main() {
  const csvPath = path.join(__dirname, '..', 'terrorzone-schedule.csv');
  const zoneIds = parseSchedule(csvPath);
  
  console.log(`Loaded ${zoneIds.length} zones\n`);
  console.log(`First 50 zones: ${zoneIds.slice(0, 50).join(', ')}\n`);
  
  findCycles(zoneIds);
  analyzeRepeats(zoneIds);
  analyzeDistances(zoneIds);
}

main();

