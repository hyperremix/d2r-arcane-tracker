// Modular Arithmetic Pattern Experiments
// Test alternative modulo strategies and mathematical transformations

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
  const dtIdx = header.findIndex(h => /date|time|datetime/i.test(h));
  const nameIdx = header.findIndex(h => /zone/i.test(h));
  const rows = lines.slice(1).map(parseCSVLine).filter(r => r.length > nameIdx);
  return rows.map(r => ({
    datetime: r[dtIdx],
    name: r[nameIdx],
    id: nameToId.get(r[nameIdx])
  }));
}

function hoursSinceStart(isoTime) {
  const start = new Date(START_ISO).getTime();
  const target = new Date(isoTime).getTime();
  return Math.floor((target - start) / (1000 * 60 * 60));
}

// PRNG base
function splitmix64(x) {
  x = (x + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  let z = x;
  z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFFFFFFFFFFFFFFn;
  z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFFFFFFFFFFFFFFn;
  z ^= z >> 31n;
  return z;
}

function pcg32_raw(state) {
  const oldstate = state;
  const newstate = (oldstate * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
  const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
  const rot = Number(oldstate >> 59n) & 31;
  return { value: ((xorshifted >>> rot) | (xorshifted << (32 - rot))) >>> 0, state: newstate };
}

// Modular arithmetic strategies
// Strategy 1: Prime modulo with rejection
function primeMod37(hourOffset) {
  const state = SEED + BigInt(hourOffset);
  const mixed = splitmix64(state);
  const zone = Number(mixed % 37n);
  return zone === 36 ? 0 : zone; // Remap 36→0
}

// Strategy 2: Power-of-2 with rejection
function powerOf2Mod64(hourOffset) {
  const state = SEED + BigInt(hourOffset);
  const mixed = splitmix64(state);
  let zone = Number(mixed & 0x3Fn); // mod 64
  while (zone >= ZONE_COUNT) {
    zone = (zone - ZONE_COUNT) % ZONE_COUNT;
  }
  return zone;
}

// Strategy 3: Fibonacci hashing
function fibonacciHash(hourOffset) {
  const state = SEED + BigInt(hourOffset);
  const mixed = splitmix64(state);
  // Golden ratio approximation: 2^64 / φ ≈ 0x9E3779B97F4A7C15
  const hashed = (mixed * 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  return Number(hashed % BigInt(ZONE_COUNT));
}

// Strategy 4: Multiplicative hash (Knuth)
function multiplicativeHash(hourOffset) {
  const state = SEED + BigInt(hourOffset);
  const mixed = splitmix64(state);
  // Knuth's multiplicative hash constant
  const hashed = (mixed * 2654435761n) & 0xFFFFFFFFFFFFFFFFn;
  return Number(hashed % BigInt(ZONE_COUNT));
}

// Strategy 5: Division method with different divisors
function divisionMethod(hourOffset, divisor = 37n) {
  const state = SEED + BigInt(hourOffset);
  const mixed = splitmix64(state);
  const zone = Number(mixed % divisor);
  return zone >= ZONE_COUNT ? zone % ZONE_COUNT : zone;
}

// Strategy 6: Folding method
function foldingMethod(hourOffset) {
  const state = SEED + BigInt(hourOffset);
  const mixed = splitmix64(state);
  // Fold 64-bit into smaller range
  const high = Number(mixed >> 32n);
  const low = Number(mixed & 0xFFFFFFFFn);
  const folded = (high ^ low) >>> 0;
  return folded % ZONE_COUNT;
}

// Strategy 7: Mid-square method
function midSquare(hourOffset) {
  const state = SEED + BigInt(hourOffset);
  const mixed = Number(splitmix64(state) & 0xFFFFFFFFn);
  const squared = BigInt(mixed) * BigInt(mixed);
  const mid = Number((squared >> 16n) & 0xFFFFFFFFn);
  return mid % ZONE_COUNT;
}

// Strategy 8: Modular exponentiation
function modularExp(hourOffset) {
  const base = Number((SEED % BigInt(ZONE_COUNT)) + 1n); // 1-36
  const exp = hourOffset % ZONE_COUNT;
  let result = 1;
  let b = base;
  let e = exp;
  while (e > 0) {
    if (e % 2 === 1) {
      result = (result * b) % ZONE_COUNT;
    }
    b = (b * b) % ZONE_COUNT;
    e = Math.floor(e / 2);
  }
  return result;
}

// Strategy 9: Linear congruential selection (different from state advance)
function lcgSelection(hourOffset) {
  const state = SEED + BigInt(hourOffset);
  const mixed = splitmix64(state);
  // Apply LCG to the mixed value
  const a = 1103515245n;
  const c = 12345n;
  const m = 2147483648n; // 2^31
  const lcgVal = (BigInt(Number(mixed & 0xFFFFFFFFn)) * a + c) % m;
  return Number(lcgVal % BigInt(ZONE_COUNT));
}

// Strategy 10: XOR folding with shift
function xorFold(hourOffset) {
  const state = SEED + BigInt(hourOffset);
  const mixed = splitmix64(state);
  // XOR different parts
  const p1 = Number(mixed & 0xFFFFn);
  const p2 = Number((mixed >> 16n) & 0xFFFFn);
  const p3 = Number((mixed >> 32n) & 0xFFFFn);
  const p4 = Number((mixed >> 48n) & 0xFFFFn);
  const folded = p1 ^ p2 ^ p3 ^ p4;
  return folded % ZONE_COUNT;
}

// Test a strategy
function testStrategy(entries, strategyFn, strategyName) {
  let matched = 0;
  let lastZone = -1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const hourOffset = hoursSinceStart(entry.datetime);

    let zoneId = strategyFn(hourOffset);

    // Immediate-repeat rejection
    let attempts = 0;
    while (zoneId === lastZone && attempts < 10) {
      attempts++;
      zoneId = strategyFn(hourOffset + attempts);
    }

    if (zoneId !== entry.id) {
      if (i > matched) {
        console.log(`[${strategyName}] Prefix match: ${matched}/${entries.length} hours (${(matched / entries.length * 100).toFixed(2)}%)`);
      }
      return matched;
    }

    matched++;
    lastZone = zoneId;
  }

  return matched;
}

console.log('=== Modular Arithmetic Pattern Experiments ===\n');

const entries = parseCsv();
console.log(`Loaded ${entries.length} schedule entries\n`);

let bestMatch = 0;
let bestStrategy = '';

const strategies = [
  { name: 'Prime Mod 37', fn: primeMod37 },
  { name: 'Power-of-2 Mod 64', fn: powerOf2Mod64 },
  { name: 'Fibonacci Hashing', fn: fibonacciHash },
  { name: 'Multiplicative Hash (Knuth)', fn: multiplicativeHash },
  { name: 'Division Method (mod 37)', fn: (h) => divisionMethod(h, 37n) },
  { name: 'Division Method (mod 41)', fn: (h) => divisionMethod(h, 41n) },
  { name: 'Division Method (mod 43)', fn: (h) => divisionMethod(h, 43n) },
  { name: 'Folding Method', fn: foldingMethod },
  { name: 'Mid-Square Method', fn: midSquare },
  { name: 'Modular Exponentiation', fn: modularExp },
  { name: 'LCG Selection', fn: lcgSelection },
  { name: 'XOR Folding', fn: xorFold }
];

for (const strat of strategies) {
  console.log(`Testing: ${strat.name}`);
  const matched = testStrategy(entries, strat.fn, strat.name);

  if (matched > bestMatch) {
    bestMatch = matched;
    bestStrategy = strat.name;
    console.log(`*** NEW BEST: ${bestMatch} hours ***\n`);
  } else {
    console.log('');
  }
}

console.log('=== Results ===');
console.log(`Best strategy: ${bestStrategy}`);
console.log(`Best match: ${bestMatch}/${entries.length} hours (${(bestMatch / entries.length * 100).toFixed(2)}%)`);
console.log(bestMatch >= 100 ? '🎉 SUCCESS! Found significant match!' : '❌ No breakthrough');
