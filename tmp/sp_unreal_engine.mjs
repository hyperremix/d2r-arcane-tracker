// Unreal Engine RNG Experiments
// D2R uses Unreal Engine - test UE4/UE5 PRNG implementations

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

// Unreal Engine FRandomStream implementation
// Source: UE4/UE5 Engine/Source/Runtime/Core/Public/Math/RandomStream.h
class FRandomStream {
  constructor(seed) {
    this.initialSeed = seed;
    this.seed = seed;
  }

  getUnsignedInt() {
    // UE uses a simple LCG with these constants
    this.seed = (this.seed * 196314165 + 907633515) >>> 0;
    return this.seed;
  }

  randHelper(max) {
    // FMath::RandHelper equivalent
    const value = this.getUnsignedInt();
    // Map to [0, max)
    return Math.floor((value / 0x100000000) * max);
  }

  reset() {
    this.seed = this.initialSeed;
  }
}

// Diablo 2 Classic RNG (from D2 source leaks/mods)
// Uses a simple LCG with specific constants
class D2ClassicRNG {
  constructor(seed) {
    this.seed = seed;
  }

  next() {
    // D2 classic uses: seed = seed * 0x015A4E35 + 1
    this.seed = Math.imul(this.seed, 0x015A4E35) + 1;
    this.seed = this.seed >>> 0; // Keep as unsigned 32-bit
    return this.seed;
  }

  randRange(min, max) {
    const range = max - min + 1;
    return min + (this.next() % range);
  }
}

// C++ std::mt19937 (Mersenne Twister) - commonly used in Unreal
class MT19937 {
  constructor(seed) {
    this.MT = new Array(624);
    this.index = 624;
    this.MT[0] = seed >>> 0;
    for (let i = 1; i < 624; i++) {
      const s = this.MT[i - 1] ^ (this.MT[i - 1] >>> 30);
      this.MT[i] = (((((s & 0xffff0000) >>> 16) * 1812433253) << 16) +
        (s & 0x0000ffff) * 1812433253 + i) >>> 0;
    }
  }

  extractNumber() {
    if (this.index >= 624) {
      this.twist();
    }
    let y = this.MT[this.index];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    this.index++;
    return y >>> 0;
  }

  twist() {
    for (let i = 0; i < 624; i++) {
      const y = (this.MT[i] & 0x80000000) + (this.MT[(i + 1) % 624] & 0x7fffffff);
      this.MT[i] = this.MT[(i + 397) % 624] ^ (y >>> 1);
      if (y % 2 !== 0) {
        this.MT[i] ^= 0x9908b0df;
      }
    }
    this.index = 0;
  }
}

// Test strategies
function testFRandomStream(entries) {
  let matched = 0;
  let lastZone = -1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const hourOffset = hoursSinceStart(entry.datetime);

    // Reseed for each hour (stateless)
    const seedValue = Number((SEED + BigInt(hourOffset)) & 0xFFFFFFFFn);
    const rng = new FRandomStream(seedValue);

    let zoneId = rng.randHelper(ZONE_COUNT);

    // Immediate-repeat rejection
    let attempts = 0;
    while (zoneId === lastZone && attempts < 10) {
      zoneId = rng.randHelper(ZONE_COUNT);
      attempts++;
    }

    if (zoneId !== entry.id) {
      if (i > matched) {
        console.log(`[FRandomStream] Prefix match: ${matched}/${entries.length}`);
      }
      return matched;
    }

    matched++;
    lastZone = zoneId;
  }

  return matched;
}

function testFRandomStreamStateful(entries) {
  let matched = 0;
  let lastZone = -1;

  const seedValue = Number(SEED & 0xFFFFFFFFn);
  const rng = new FRandomStream(seedValue);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    let zoneId = rng.randHelper(ZONE_COUNT);

    // Immediate-repeat rejection
    let attempts = 0;
    while (zoneId === lastZone && attempts < 10) {
      zoneId = rng.randHelper(ZONE_COUNT);
      attempts++;
    }

    if (zoneId !== entry.id) {
      if (i > matched) {
        console.log(`[FRandomStream Stateful] Prefix match: ${matched}/${entries.length}`);
      }
      return matched;
    }

    matched++;
    lastZone = zoneId;
  }

  return matched;
}

function testD2Classic(entries) {
  let matched = 0;
  let lastZone = -1;

  const seedValue = Number(SEED & 0xFFFFFFFFn);
  const rng = new D2ClassicRNG(seedValue);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    let zoneId = rng.randRange(0, ZONE_COUNT - 1);

    // Immediate-repeat rejection
    let attempts = 0;
    while (zoneId === lastZone && attempts < 10) {
      zoneId = rng.randRange(0, ZONE_COUNT - 1);
      attempts++;
    }

    if (zoneId !== entry.id) {
      if (i > matched) {
        console.log(`[D2 Classic RNG] Prefix match: ${matched}/${entries.length}`);
      }
      return matched;
    }

    matched++;
    lastZone = zoneId;
  }

  return matched;
}

function testMT19937(entries) {
  let matched = 0;
  let lastZone = -1;

  const seedValue = Number(SEED & 0xFFFFFFFFn);
  const rng = new MT19937(seedValue);

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    let zoneId = rng.extractNumber() % ZONE_COUNT;

    // Immediate-repeat rejection
    let attempts = 0;
    while (zoneId === lastZone && attempts < 10) {
      zoneId = rng.extractNumber() % ZONE_COUNT;
      attempts++;
    }

    if (zoneId !== entry.id) {
      if (i > matched) {
        console.log(`[MT19937 (std::mt19937)] Prefix match: ${matched}/${entries.length}`);
      }
      return matched;
    }

    matched++;
    lastZone = zoneId;
  }

  return matched;
}

// Test with hour-based reseeding
function testMT19937Hourly(entries) {
  let matched = 0;
  let lastZone = -1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const hourOffset = hoursSinceStart(entry.datetime);

    const seedValue = Number((SEED ^ BigInt(hourOffset)) & 0xFFFFFFFFn);
    const rng = new MT19937(seedValue);

    let zoneId = rng.extractNumber() % ZONE_COUNT;

    // Immediate-repeat rejection
    let attempts = 0;
    while (zoneId === lastZone && attempts < 10) {
      zoneId = rng.extractNumber() % ZONE_COUNT;
      attempts++;
    }

    if (zoneId !== entry.id) {
      if (i > matched) {
        console.log(`[MT19937 Hourly Reseed] Prefix match: ${matched}/${entries.length}`);
      }
      return matched;
    }

    matched++;
    lastZone = zoneId;
  }

  return matched;
}

console.log('=== Unreal Engine / Game RNG Experiments ===\n');

const entries = parseCsv();
console.log(`Loaded ${entries.length} schedule entries\n`);

let bestMatch = 0;
let bestStrategy = '';

const strategies = [
  { name: 'UE FRandomStream (stateless)', fn: () => testFRandomStream(entries) },
  { name: 'UE FRandomStream (stateful)', fn: () => testFRandomStreamStateful(entries) },
  { name: 'D2 Classic RNG', fn: () => testD2Classic(entries) },
  { name: 'C++ std::mt19937', fn: () => testMT19937(entries) },
  { name: 'MT19937 (hourly reseed)', fn: () => testMT19937Hourly(entries) }
];

for (const strat of strategies) {
  console.log(`Testing: ${strat.name}`);
  const matched = strat.fn();

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
