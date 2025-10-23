// Temporal Seed Derivation Experiments
// Test if D2R uses actual wall-clock timestamp to derive PRNG state

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

// PRNG functions
function splitmix64(x) {
  x = (x + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  let z = x;
  z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFFFFFFFFFFFFFFn;
  z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFFFFFFFFFFFFFFn;
  z ^= z >> 31n;
  return Number(z >> 32n) >>> 0;
}

function pcg32(state, mul = 6364136223846793005n, inc = 1442695040888963407n) {
  const oldstate = state.value;
  state.value = (oldstate * mul + inc) & 0xFFFFFFFFFFFFFFFFn;
  const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
  const rot = Number(oldstate >> 59n) & 31;
  return ((xorshifted >>> rot) | (xorshifted << (32 - rot))) >>> 0;
}

function wyhash64(x) {
  x ^= x >> 32n;
  x = (x * 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  x ^= x >> 29n;
  x = (x * 0xBF58476D1CE4E5B9n) & 0xFFFFFFFFFFFFFFFFn;
  x ^= x >> 32n;
  return Number(x >> 32n) >>> 0;
}

// Temporal derivation strategies
function deriveFromUnixSeconds(isoTime, seed) {
  const unixSec = BigInt(Math.floor(new Date(isoTime).getTime() / 1000));
  return (seed ^ unixSec) & 0xFFFFFFFFFFFFFFFFn;
}

function deriveFromUnixHours(isoTime, seed) {
  const unixHours = BigInt(Math.floor(new Date(isoTime).getTime() / (1000 * 60 * 60)));
  return (seed + unixHours) & 0xFFFFFFFFFFFFFFFFn;
}

function deriveFromDateComponents(isoTime, seed) {
  const d = new Date(isoTime);
  const year = BigInt(d.getUTCFullYear());
  const month = BigInt(d.getUTCMonth() + 1);
  const day = BigInt(d.getUTCDate());
  const hour = BigInt(d.getUTCHours());
  // Pack: YYYYMMDD HH
  const packed = (year << 32n) | (month << 24n) | (day << 16n) | hour;
  return (seed ^ packed) & 0xFFFFFFFFFFFFFFFFn;
}

function deriveFromJulianDay(isoTime, seed) {
  const d = new Date(isoTime);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  // Simplified Julian day calculation
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  const jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
  const hour = d.getUTCHours();
  return (seed + BigInt(jdn * 24 + hour)) & 0xFFFFFFFFFFFFFFFFn;
}

function deriveFromISOWeek(isoTime, seed) {
  const d = new Date(isoTime);
  // Get ISO week number
  const target = new Date(d.valueOf());
  const dayNr = (d.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNum = 1 + Math.ceil((firstThursday - target) / 604800000);
  const hour = d.getUTCHours();
  return (seed ^ BigInt(weekNum * 168 + hour)) & 0xFFFFFFFFFFFFFFFFn;
}

// Test a derivation strategy
function testStrategy(entries, deriveFn, mixerFn, strategyName) {
  let matched = 0;
  let lastZone = -1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const derivedSeed = deriveFn(entry.datetime, SEED);
    const mixed = mixerFn(derivedSeed);

    // Try with immediate-repeat rejection
    let zoneId = (mixed % ZONE_COUNT);

    // If same as last, try next value
    if (zoneId === lastZone) {
      const altMixed = mixerFn(derivedSeed + 1n);
      zoneId = (altMixed % ZONE_COUNT);
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

function testStatefulStrategy(entries, deriveFn, prngFn, strategyName) {
  let matched = 0;
  let lastZone = -1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const derivedSeed = deriveFn(entry.datetime, SEED);
    const state = { value: derivedSeed };

    let zoneId = (prngFn(state) % ZONE_COUNT);

    // Immediate-repeat rejection
    while (zoneId === lastZone) {
      zoneId = (prngFn(state) % ZONE_COUNT);
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

console.log('=== Temporal Seed Derivation Experiments ===\n');

const entries = parseCsv();
console.log(`Loaded ${entries.length} schedule entries\n`);

let bestMatch = 0;
let bestStrategy = '';

// Test combinations
const strategies = [
  {
    name: 'Unix Seconds XOR + SplitMix64',
    derive: deriveFromUnixSeconds,
    mix: splitmix64,
    stateless: true
  },
  {
    name: 'Unix Hours ADD + SplitMix64',
    derive: deriveFromUnixHours,
    mix: splitmix64,
    stateless: true
  },
  {
    name: 'Date Components XOR + WyHash64',
    derive: deriveFromDateComponents,
    mix: wyhash64,
    stateless: true
  },
  {
    name: 'Julian Day + SplitMix64',
    derive: deriveFromJulianDay,
    mix: splitmix64,
    stateless: true
  },
  {
    name: 'ISO Week + SplitMix64',
    derive: deriveFromISOWeek,
    mix: splitmix64,
    stateless: true
  },
  {
    name: 'Unix Seconds XOR + PCG32 (stateful)',
    derive: deriveFromUnixSeconds,
    prng: pcg32,
    stateless: false
  },
  {
    name: 'Unix Hours ADD + PCG32 (stateful)',
    derive: deriveFromUnixHours,
    prng: pcg32,
    stateless: false
  },
  {
    name: 'Date Components + PCG32 (stateful)',
    derive: deriveFromDateComponents,
    prng: pcg32,
    stateless: false
  }
];

for (const strat of strategies) {
  console.log(`Testing: ${strat.name}`);
  const matched = strat.stateless
    ? testStrategy(entries, strat.derive, strat.mix, strat.name)
    : testStatefulStrategy(entries, strat.derive, strat.prng, strat.name);

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
