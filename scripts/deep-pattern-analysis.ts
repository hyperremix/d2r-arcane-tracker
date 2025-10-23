/**
 * Deep pattern analysis of the terror zone schedule
 * 
 * Goals:
 * 1. Look for hidden patterns in zone sequences
 * 2. Analyze if zones follow specific rules (e.g., no consecutive repeats, act-based rotation)
 * 3. Check for day-of-week patterns or cyclical behavior
 * 4. Try to find the "bag size" if using a bag system
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

// Reverse mapping
const ID_TO_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(ZONE_NAMES).map(([name, id]) => [id, name])
);

// Zone to Act mapping
const ZONE_TO_ACT: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 1, 9: 1, 10: 1, 11: 1, 12: 1,
  13: 2, 14: 2, 15: 2, 16: 2, 17: 2, 18: 2, 19: 2, 20: 2,
  21: 3, 22: 3, 23: 3, 24: 3, 25: 3, 26: 3,
  27: 4, 28: 4, 29: 4,
  30: 5, 31: 5, 32: 5, 33: 5, 34: 5, 35: 5, 36: 5,
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

function analyzeDuplicates(entries: Entry[]): void {
  console.log('\n=== Consecutive Duplicate Analysis ===');
  let duplicates = 0;
  for (let i = 1; i < entries.length; i++) {
    if (entries[i].zoneId === entries[i - 1].zoneId) {
      duplicates++;
      console.log(`  Duplicate at ${i}: Zone ${entries[i].zoneId} (${ID_TO_NAME[entries[i].zoneId]})`);
    }
  }
  console.log(`Total consecutive duplicates: ${duplicates}/${entries.length} (${(duplicates / entries.length * 100).toFixed(2)}%)`);
}

function analyzeTransitions(entries: Entry[]): void {
  console.log('\n=== Transition Matrix (Top 20 most common transitions) ===');
  const transitions: Record<string, number> = {};
  
  for (let i = 1; i < entries.length; i++) {
    const from = entries[i - 1].zoneId;
    const to = entries[i].zoneId;
    const key = `${from}->${to}`;
    transitions[key] = (transitions[key] || 0) + 1;
  }
  
  const sorted = Object.entries(transitions).sort(([, a], [, b]) => b - a).slice(0, 20);
  
  for (const [transition, count] of sorted) {
    const [from, to] = transition.split('->').map(Number);
    console.log(`  ${from.toString().padStart(2)} -> ${to.toString().padStart(2)}: ${count} times`);
  }
}

function analyzeCycles(entries: Entry[]): void {
  console.log('\n=== Cycle Detection ===');
  
  // Try to find repeating sequences of different lengths
  for (const cycleLen of [36, 40, 50, 72, 100, 144, 200]) {
    let matches = 0;
    let possible = 0;
    
    for (let i = cycleLen; i < Math.min(entries.length, cycleLen * 3); i++) {
      if (entries[i].zoneId === entries[i - cycleLen].zoneId) {
        matches++;
      }
      possible++;
    }
    
    const accuracy = possible > 0 ? (matches / possible) * 100 : 0;
    if (accuracy > 10) {
      console.log(`  Cycle length ${cycleLen}: ${accuracy.toFixed(2)}% match (${matches}/${possible})`);
    }
  }
}

function analyzeActDistribution(entries: Entry[]): void {
  console.log('\n=== Act Distribution ===');
  const actCounts: Record<number, number> = {};
  
  for (const entry of entries) {
    const act = ZONE_TO_ACT[entry.zoneId];
    actCounts[act] = (actCounts[act] || 0) + 1;
  }
  
  console.log('Total entries by act:');
  for (const [act, count] of Object.entries(actCounts).sort(([a], [b]) => Number(a) - Number(b))) {
    console.log(`  Act ${act}: ${count} (${(count / entries.length * 100).toFixed(1)}%)`);
  }
  
  // Check for act-based patterns
  console.log('\nAct transitions (first 30):');
  for (let i = 1; i < Math.min(30, entries.length); i++) {
    const fromAct = ZONE_TO_ACT[entries[i - 1].zoneId];
    const toAct = ZONE_TO_ACT[entries[i].zoneId];
    console.log(`  ${i}: Act ${fromAct} -> Act ${toAct} (zones ${entries[i - 1].zoneId} -> ${entries[i].zoneId})`);
  }
}

function analyzeZoneFrequencies(entries: Entry[]): void {
  console.log('\n=== Zone Frequency Distribution ===');
  const zoneCounts: Record<number, number> = {};
  
  for (const entry of entries) {
    zoneCounts[entry.zoneId] = (zoneCounts[entry.zoneId] || 0) + 1;
  }
  
  const expected = entries.length / 36;
  console.log(`Expected count per zone (uniform): ${expected.toFixed(2)}`);
  console.log('\nZone frequencies:');
  
  const sorted = Object.entries(zoneCounts).sort(([, a], [, b]) => b - a);
  for (const [zoneId, count] of sorted) {
    const deviation = ((count - expected) / expected * 100);
    const bar = '='.repeat(Math.round(count / 5));
    console.log(`  Zone ${zoneId.toString().padStart(2)}: ${count.toString().padStart(3)} ${bar} (${deviation > 0 ? '+' : ''}${deviation.toFixed(1)}%)`);
  }
}

function analyzeRepeatDistances(entries: Entry[]): void {
  console.log('\n=== Repeat Distance Analysis ===');
  
  const lastSeen: Record<number, number> = {};
  const distances: number[] = [];
  
  for (let i = 0; i < entries.length; i++) {
    const zoneId = entries[i].zoneId;
    
    if (lastSeen[zoneId] !== undefined) {
      const distance = i - lastSeen[zoneId];
      distances.push(distance);
    }
    
    lastSeen[zoneId] = i;
  }
  
  // Count distance frequencies
  const distanceCounts: Record<number, number> = {};
  for (const d of distances) {
    distanceCounts[d] = (distanceCounts[d] || 0) + 1;
  }
  
  console.log('Most common distances between same zone appearances:');
  const sorted = Object.entries(distanceCounts).sort(([, a], [, b]) => b - a).slice(0, 20);
  for (const [distance, count] of sorted) {
    const bar = '█'.repeat(Math.round(count / 2));
    console.log(`  Distance ${distance.toString().padStart(3)}: ${count.toString().padStart(3)} ${bar}`);
  }
  
  const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
  const minDistance = Math.min(...distances);
  const maxDistance = Math.max(...distances);
  
  console.log(`\nStatistics:`);
  console.log(`  Average distance: ${avgDistance.toFixed(2)}`);
  console.log(`  Min distance: ${minDistance}`);
  console.log(`  Max distance: ${maxDistance}`);
}

function findLongestMatch(entries: Entry[]): void {
  console.log('\n=== Finding Longest Matching Subsequence ===');
  
  // Try to find if any part of the schedule repeats exactly
  let maxMatch = 0;
  let maxOffset = 0;
  let maxPos = 0;
  
  for (let offset = 1; offset < Math.min(500, entries.length / 2); offset++) {
    for (let start = 0; start < entries.length - offset - 20; start++) {
      let matchLen = 0;
      
      while (
        start + offset + matchLen < entries.length &&
        entries[start + matchLen].zoneId === entries[start + offset + matchLen].zoneId
      ) {
        matchLen++;
      }
      
      if (matchLen > maxMatch && matchLen >= 5) {
        maxMatch = matchLen;
        maxOffset = offset;
        maxPos = start;
      }
    }
  }
  
  if (maxMatch > 0) {
    console.log(`Longest exact match: ${maxMatch} consecutive zones`);
    console.log(`  Position: ${maxPos}`);
    console.log(`  Offset: ${maxOffset}`);
    console.log(`  Sequence 1: ${entries.slice(maxPos, maxPos + Math.min(10, maxMatch)).map(e => e.zoneId).join(', ')}`);
    console.log(`  Sequence 2: ${entries.slice(maxPos + maxOffset, maxPos + maxOffset + Math.min(10, maxMatch)).map(e => e.zoneId).join(', ')}`);
  } else {
    console.log('No significant repeating subsequences found');
  }
}

function analyzeHourOfDay(entries: Entry[]): void {
  console.log('\n=== Hour of Day Analysis ===');
  
  const hourCounts: Record<number, Record<number, number>> = {};
  
  for (const entry of entries) {
    const hour = entry.timestamp.getUTCHours();
    const zoneId = entry.zoneId;
    
    if (!hourCounts[hour]) hourCounts[hour] = {};
    hourCounts[hour][zoneId] = (hourCounts[hour][zoneId] || 0) + 1;
  }
  
  console.log('Checking if certain zones appear more often at certain hours...');
  let patternFound = false;
  
  for (const [hour, zones] of Object.entries(hourCounts)) {
    const total = Object.values(zones).reduce((a, b) => a + b, 0);
    const sorted = Object.entries(zones).sort(([, a], [, b]) => b - a);
    
    // If any zone appears >50% at this hour, it's a pattern
    for (const [zoneId, count] of sorted) {
      if (count / total > 0.5) {
        console.log(`  Hour ${hour.toString().padStart(2)}: Zone ${zoneId} appears ${count}/${total} times (${(count / total * 100).toFixed(1)}%)`);
        patternFound = true;
      }
    }
  }
  
  if (!patternFound) {
    console.log('  No strong hour-of-day patterns detected');
  }
}

function main(): void {
  console.log('D2R Terror Zone Deep Pattern Analysis');
  console.log('='.repeat(60));
  
  const csvPath = path.join(__dirname, '..', 'terrorzone-schedule.csv');
  const entries = parseCSV(csvPath);
  
  console.log(`\nLoaded ${entries.length} schedule entries`);
  console.log(`Date range: ${entries[0].timestamp.toISOString()} to ${entries[entries.length - 1].timestamp.toISOString()}`);
  console.log(`\nFirst 50 zone IDs:`);
  console.log(entries.slice(0, 50).map(e => e.zoneId).join(', '));
  
  analyzeDuplicates(entries);
  analyzeZoneFrequencies(entries);
  analyzeRepeatDistances(entries);
  analyzeActDistribution(entries);
  analyzeTransitions(entries);
  analyzeCycles(entries);
  analyzeHourOfDay(entries);
  findLongestMatch(entries);
  
  console.log('\n' + '='.repeat(60));
  console.log('Analysis Complete');
  console.log('='.repeat(60));
}

main();

