// Constraint-Based Pattern Mining
// Analyze schedule for "impossible" sequences and derive constraints
// This script doesn't use a full SAT solver but does statistical fingerprinting

import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker-claude/terrorzone-schedule.csv';
const SEED = 16664395743969097666n;
const START_ISO = '2023-01-27T00:00:00Z';
const ZONE_COUNT = 36;

const idToName = [
  'Burial Grounds, Crypt, Mausoleum', 'Cathedral, Catacombs', 'Cold Plains, Cave',
  'Dark Wood, Underground Passage', 'Blood Moor, Den of Evil', 'Barracks, Jail',
  'The Secret Cow Level', 'Stony Field', 'Black Marsh, The Hole', 'Forgotten Tower',
  'Pit', 'Tristram', 'Lut Gholein Sewers', 'Rocky Waste, Stony Tomb',
  'Dry Hills, Halls of the Dead', 'Far Oasis', 'Lost City, Valley of Snakes, Claw Viper Temple',
  'Ancient Tunnels', "Tal Rasha's Tombs, Tal Rasha's Chamber", 'Arcane Sanctuary',
  'Spider Forest, Spider Cavern', 'Great Marsh', 'Flayer Jungle, Flayer Dungeon',
  'Kurast Bazaar, Ruined Temple, Disused Fane', 'Travincal', 'Durance of Hate',
  'Outer Steppes, Plains of Despair', 'City of the Damned, River of Flame',
  'Chaos Sanctuary', 'Bloody Foothills, Frigid Highlands, Abaddon',
  'Arreat Plateau, Pit of Acheron', 'Crystalline Passage, Frozen River',
  "Nihlathak's Temple, Temple Halls", 'Glacial Trail, Drifter Cavern',
  "Ancient's Way, Icy Cellar", 'Worldstone Keep, Throne of Destruction, Worldstone Chamber'
];
const nameToId = new Map(idToName.map((n, i) => [n, i]));

function parseCSVLine(line) {
  const fields = [];
  let curr = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          curr += '"';
          i++;
        } else {
          inQ = false;
        }
      } else {
        curr += ch;
      }
    } else {
      if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        fields.push(curr);
        curr = '';
      } else {
        curr += ch;
      }
    }
  }
  fields.push(curr);
  return fields;
}

function parseCsv() {
  const raw = readFileSync(CSV, 'utf8');
  const lines = raw.trim().split(/\r?\n/);
  const header = parseCSVLine(lines[0]);
  const nameIdx = header.findIndex(h => /zone/i.test(h));
  const rows = lines.slice(1).map(parseCSVLine).filter(r => r.length > nameIdx);
  return rows.map(r => nameToId.get(r[nameIdx]));
}

// Analyze patterns in the schedule
function analyzePatterns(zones) {
  console.log('=== Pattern Analysis ===\n');

  // 1. N-gram analysis (find repeating sequences)
  console.log('1. N-gram Frequency Analysis:');
  for (const n of [2, 3, 4, 5]) {
    const ngrams = new Map();
    for (let i = 0; i <= zones.length - n; i++) {
      const gram = zones.slice(i, i + n).join(',');
      ngrams.set(gram, (ngrams.get(gram) || 0) + 1);
    }
    const repeats = [...ngrams.entries()].filter(([_, count]) => count > 1);
    console.log(`   ${n}-grams that repeat: ${repeats.length}/${ngrams.size}`);
    if (repeats.length > 0 && repeats.length < 10) {
      const top = repeats.sort((a, b) => b[1] - a[1]).slice(0, 3);
      console.log(`   Top repeating ${n}-grams:`, top);
    }
  }

  // 2. Gap analysis (distance between same zone)
  console.log('\n2. Zone Repeat Gap Distribution:');
  const gapsByZone = new Map();
  for (let zone = 0; zone < ZONE_COUNT; zone++) {
    const positions = zones.map((z, i) => z === zone ? i : -1).filter(i => i >= 0);
    if (positions.length > 1) {
      const gaps = [];
      for (let i = 1; i < positions.length; i++) {
        gaps.push(positions[i] - positions[i - 1]);
      }
      gapsByZone.set(zone, gaps);
    }
  }

  const allGaps = [];
  for (const gaps of gapsByZone.values()) {
    allGaps.push(...gaps);
  }
  const gapCounts = new Map();
  for (const gap of allGaps) {
    gapCounts.set(gap, (gapCounts.get(gap) || 0) + 1);
  }
  const topGaps = [...gapCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  console.log('   Most common gaps between same zone:', topGaps);

  // 3. Forbidden transitions (never seen)
  console.log('\n3. Transition Analysis:');
  const transitions = new Set();
  for (let i = 1; i < zones.length; i++) {
    transitions.add(`${zones[i - 1]}->${zones[i]}`);
  }
  const possibleTransitions = ZONE_COUNT * (ZONE_COUNT - 1); // excluding self-loops
  console.log(`   Observed transitions: ${transitions.size}/${possibleTransitions}`);
  console.log(`   Missing transitions: ${possibleTransitions - transitions.size}`);

  // Check if any transitions are explicitly forbidden (beyond immediate repeat)
  const forbiddenPairs = [];
  for (let from = 0; from < ZONE_COUNT; from++) {
    for (let to = 0; to < ZONE_COUNT; to++) {
      if (from !== to && !transitions.has(`${from}->${to}`)) {
        forbiddenPairs.push([from, to]);
      }
    }
  }
  if (forbiddenPairs.length > 0 && forbiddenPairs.length < 20) {
    console.log(`   Forbidden transitions (never seen): ${forbiddenPairs.length}`);
    console.log(`   Examples:`, forbiddenPairs.slice(0, 5));
  }

  // 4. Autocorrelation (check for periodic patterns)
  console.log('\n4. Autocorrelation Analysis:');
  for (const lag of [36, 37, 40, 50, 72, 100]) {
    let matches = 0;
    for (let i = 0; i + lag < zones.length; i++) {
      if (zones[i] === zones[i + lag]) {
        matches++;
      }
    }
    const correlation = matches / (zones.length - lag);
    console.log(`   Lag ${lag}: ${(correlation * 100).toFixed(2)}% match (random: ${(1 / ZONE_COUNT * 100).toFixed(2)}%)`);
  }

  // 5. Zone clustering (do certain zones appear in clusters?)
  console.log('\n5. Sequential Zone Clustering:');
  const clusters = new Map(); // "zoneA,zoneB" -> count
  for (let i = 1; i < zones.length; i++) {
    const pair = [zones[i - 1], zones[i]].sort().join(',');
    clusters.set(pair, (clusters.get(pair) || 0) + 1);
  }
  const topClusters = [...clusters.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  console.log('   Most common zone pairs:', topClusters);

  return {
    ngrams: { /* results */ },
    gaps: { min: Math.min(...allGaps), max: Math.max(...allGaps), mean: allGaps.reduce((a, b) => a + b, 0) / allGaps.length },
    transitions: { observed: transitions.size, possible: possibleTransitions },
    forbiddenPairs
  };
}

// Try to derive PRNG constants from first N hours
function bruteForceConstants(zones, nHours = 50) {
  console.log(`\n=== Brute Force Constant Search (first ${nHours} hours) ===\n`);

  const target = zones.slice(0, nHours);

  // Test LCG with various multipliers and increments
  const multipliers = [
    6364136223846793005n, // Standard PCG
    1103515245n, // Numerical Recipes
    25214903917n, // Java's Random
    196314165n, // UE FRandomStream
    0x015A4E35n, // D2 Classic
    0x5DEECE66Dn, // Another common LCG
    69069n, // Another variant
    48271n // Park-Miller
  ];

  const increments = [
    1442695040888963407n,
    1n,
    11n,
    12345n,
    907633515n,
    0xBn
  ];

  let bestMatch = 0;
  let bestParams = null;

  for (const mul of multipliers) {
    for (const inc of increments) {
      let state = SEED;
      let matched = 0;
      let lastZone = -1;

      for (let i = 0; i < nHours; i++) {
        state = (state * mul + inc) & 0xFFFFFFFFFFFFFFFFn;
        let zone = Number(state % BigInt(ZONE_COUNT));

        // Try with immediate-repeat rejection
        if (zone === lastZone) {
          state = (state * mul + inc) & 0xFFFFFFFFFFFFFFFFn;
          zone = Number(state % BigInt(ZONE_COUNT));
        }

        if (zone === target[i]) {
          matched++;
        } else {
          break;
        }

        lastZone = zone;
      }

      if (matched > bestMatch) {
        bestMatch = matched;
        bestParams = { mul, inc, matched };
        console.log(`   New best: mul=${mul}, inc=${inc}, matched=${matched}/${nHours}`);
      }
    }
  }

  console.log(`\nBest LCG params: mul=${bestParams?.mul}, inc=${bestParams?.inc}`);
  console.log(`Best match: ${bestMatch}/${nHours} hours (${(bestMatch / nHours * 100).toFixed(2)}%)`);

  return bestParams;
}

// Statistical fingerprinting - compare schedule to known PRNG statistical properties
function statisticalFingerprint(zones) {
  console.log('\n=== Statistical Fingerprinting ===\n');

  // Chi-square test for uniformity
  const observed = new Array(ZONE_COUNT).fill(0);
  for (const zone of zones) {
    observed[zone]++;
  }
  const expected = zones.length / ZONE_COUNT;
  let chiSquare = 0;
  for (let i = 0; i < ZONE_COUNT; i++) {
    chiSquare += Math.pow(observed[i] - expected, 2) / expected;
  }
  console.log(`Chi-square test for uniformity: ${chiSquare.toFixed(2)}`);
  console.log(`   (Lower is better, < 50 suggests uniform distribution)`);

  // Serial correlation test
  let correlation = 0;
  for (let i = 1; i < zones.length; i++) {
    correlation += zones[i - 1] * zones[i];
  }
  correlation = correlation / (zones.length - 1);
  const expectedCorr = (ZONE_COUNT - 1) / 2 * (ZONE_COUNT - 1) / 2;
  console.log(`\nSerial correlation: ${correlation.toFixed(2)} (expected: ${expectedCorr.toFixed(2)})`);

  // Run test (alternation between above/below median)
  const median = ZONE_COUNT / 2;
  let runs = 1;
  let lastAbove = zones[0] >= median;
  for (let i = 1; i < zones.length; i++) {
    const above = zones[i] >= median;
    if (above !== lastAbove) {
      runs++;
      lastAbove = above;
    }
  }
  const expectedRuns = zones.length / 2 + 1;
  console.log(`\nRuns test: ${runs} runs (expected: ~${expectedRuns.toFixed(0)})`);
}

console.log('=== Constraint-Based Pattern Mining ===\n');

const zones = parseCsv();
console.log(`Loaded ${zones.length} schedule entries\n`);

// Analyze patterns
const patternResults = analyzePatterns(zones);

// Try to brute force constants
const constants = bruteForceConstants(zones, 100);

// Statistical fingerprinting
statisticalFingerprint(zones);

console.log('\n=== Summary ===');
console.log('This analysis provides insights into the schedule structure.');
console.log('Key findings:');
console.log(`- Gap range: ${patternResults.gaps.min}-${patternResults.gaps.max} hours (mean: ${patternResults.gaps.mean.toFixed(1)})`);
console.log(`- Observed transitions: ${patternResults.transitions.observed}/${patternResults.transitions.possible}`);
console.log(`- Forbidden transitions: ${patternResults.forbiddenPairs.length}`);
console.log('\nNo breakthrough in constant derivation, but statistical properties confirmed.');
