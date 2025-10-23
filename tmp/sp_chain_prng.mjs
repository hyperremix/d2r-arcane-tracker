// Multi-State PRNG Chain Experiments
// Test cascaded/chained PRNG approaches where one generator feeds another

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

// PRNG implementations
function splitmix64_next(state) {
  state.value = (state.value + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  let z = state.value;
  z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFFFFFFFFFFFFFFn;
  z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFFFFFFFFFFFFFFn;
  z ^= z >> 31n;
  return Number(z >> 32n) >>> 0;
}

function pcg32_next(state) {
  const oldstate = state.value;
  state.value = (oldstate * 6364136223846793005n + 1442695040888963407n) & 0xFFFFFFFFFFFFFFFFn;
  const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
  const rot = Number(oldstate >> 59n) & 31;
  return ((xorshifted >>> rot) | (xorshifted << (32 - rot))) >>> 0;
}

function xorshift64_next(state) {
  let x = state.value;
  x ^= x << 13n;
  x &= 0xFFFFFFFFFFFFFFFFn;
  x ^= x >> 7n;
  x ^= x << 17n;
  x &= 0xFFFFFFFFFFFFFFFFn;
  state.value = x;
  return Number(x >> 32n) >>> 0;
}

function lcg64_next(state) {
  state.value = (state.value * 6364136223846793005n + 1n) & 0xFFFFFFFFFFFFFFFFn;
  return Number(state.value >> 32n) >>> 0;
}

// Chained PRNG strategies
// Strategy 1: PCG → SplitMix → Selection
function chainPcgSplitmix(hourOffset) {
  const pcgState = { value: SEED + BigInt(hourOffset) };
  const pcgOut = pcg32_next(pcgState);

  const smState = { value: BigInt(pcgOut) | (SEED & 0xFFFFFFFF00000000n) };
  const smOut = splitmix64_next(smState);

  return smOut % ZONE_COUNT;
}

// Strategy 2: SplitMix → PCG → Selection
function chainSplitmixPcg(hourOffset) {
  const smState = { value: SEED ^ BigInt(hourOffset) };
  const smOut = splitmix64_next(smState);

  const pcgState = { value: BigInt(smOut) << 32n | SEED & 0xFFFFFFFFn };
  const pcgOut = pcg32_next(pcgState);

  return pcgOut % ZONE_COUNT;
}

// Strategy 3: Dual stream (one for hour, one for zone)
function dualStream(hourOffset) {
  const streamA = { value: SEED };
  const streamB = { value: SEED ^ 0xAAAAAAAAAAAAAAAAn };

  // Advance streamA by hour offset
  for (let i = 0; i < hourOffset; i++) {
    pcg32_next(streamA);
  }

  // Use streamA to reseed streamB
  const reseed = BigInt(pcg32_next(streamA));
  streamB.value = (streamB.value ^ (reseed << 32n)) & 0xFFFFFFFFFFFFFFFFn;

  // Draw from streamB
  return pcg32_next(streamB) % ZONE_COUNT;
}

// Strategy 4: Triple cascade (LCG → PCG → SplitMix)
function tripleCascade(hourOffset) {
  const lcgState = { value: SEED + BigInt(hourOffset) };
  const lcgOut = lcg64_next(lcgState);

  const pcgState = { value: BigInt(lcgOut) << 32n | (SEED & 0xFFFFFFFFn) };
  const pcgOut = pcg32_next(pcgState);

  const smState = { value: BigInt(pcgOut) << 32n | BigInt(lcgOut & 0xFFFFFFFF) };
  const smOut = splitmix64_next(smState);

  return smOut % ZONE_COUNT;
}

// Strategy 5: Interleaved draws (draw from A, then B, use XOR)
function interleavedStreams(hourOffset) {
  const streamA = { value: SEED };
  const streamB = { value: SEED ^ BigInt(hourOffset) };

  const outA = pcg32_next(streamA);
  const outB = splitmix64_next(streamB);

  return (outA ^ outB) % ZONE_COUNT;
}

// Strategy 6: Hierarchical (master RNG picks which slave RNG to use)
function hierarchical(hourOffset) {
  const master = { value: SEED + BigInt(hourOffset) };
  const masterOut = splitmix64_next(master) % 3; // Pick from 3 slaves

  const slave1 = { value: SEED };
  const slave2 = { value: SEED ^ 0x5555555555555555n };
  const slave3 = { value: SEED ^ 0xAAAAAAAAAAAAAAAAn };

  // Advance chosen slave
  for (let i = 0; i < hourOffset; i++) {
    if (masterOut === 0) pcg32_next(slave1);
    else if (masterOut === 1) splitmix64_next(slave2);
    else xorshift64_next(slave3);
  }

  if (masterOut === 0) return pcg32_next(slave1) % ZONE_COUNT;
  if (masterOut === 1) return splitmix64_next(slave2) % ZONE_COUNT;
  return xorshift64_next(slave3) % ZONE_COUNT;
}

// Test a strategy
function testChainStrategy(entries, strategyFn, strategyName) {
  let matched = 0;
  let lastZone = -1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const hourOffset = hoursSinceStart(entry.datetime);

    let zoneId = strategyFn(hourOffset);

    // Immediate-repeat rejection
    let attempts = 0;
    while (zoneId === lastZone && attempts < 100) {
      zoneId = strategyFn(hourOffset + attempts + 1);
      attempts++;
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

// Stateful chain test (maintains state between hours)
function testStatefulChain(entries, strategyName, initFn, nextFn) {
  let matched = 0;
  let lastZone = -1;

  const state = initFn();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    let zoneId = nextFn(state);

    // Immediate-repeat rejection
    let attempts = 0;
    while (zoneId === lastZone && attempts < 10) {
      zoneId = nextFn(state);
      attempts++;
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

console.log('=== Multi-State PRNG Chain Experiments ===\n');

const entries = parseCsv();
console.log(`Loaded ${entries.length} schedule entries\n`);

let bestMatch = 0;
let bestStrategy = '';

const strategies = [
  { name: 'PCG → SplitMix', fn: chainPcgSplitmix },
  { name: 'SplitMix → PCG', fn: chainSplitmixPcg },
  { name: 'Dual Stream', fn: dualStream },
  { name: 'Triple Cascade (LCG→PCG→SM)', fn: tripleCascade },
  { name: 'Interleaved (PCG⊕SM)', fn: interleavedStreams },
  { name: 'Hierarchical 3-way', fn: hierarchical }
];

// Stateful strategies
const statefulStrategies = [
  {
    name: 'Stateful PCG→SM Chain',
    init: () => ({ pcg: { value: SEED }, sm: { value: SEED } }),
    next: (state) => {
      const pcgOut = pcg32_next(state.pcg);
      state.sm.value = (state.sm.value ^ BigInt(pcgOut)) & 0xFFFFFFFFFFFFFFFFn;
      return splitmix64_next(state.sm) % ZONE_COUNT;
    }
  },
  {
    name: 'Stateful Alternating PCG/SM',
    init: () => ({ pcg: { value: SEED }, sm: { value: SEED }, toggle: false }),
    next: (state) => {
      state.toggle = !state.toggle;
      if (state.toggle) {
        return pcg32_next(state.pcg) % ZONE_COUNT;
      } else {
        return splitmix64_next(state.sm) % ZONE_COUNT;
      }
    }
  }
];

for (const strat of strategies) {
  console.log(`Testing: ${strat.name}`);
  const matched = testChainStrategy(entries, strat.fn, strat.name);

  if (matched > bestMatch) {
    bestMatch = matched;
    bestStrategy = strat.name;
    console.log(`*** NEW BEST: ${bestMatch} hours ***\n`);
  } else {
    console.log('');
  }
}

for (const strat of statefulStrategies) {
  console.log(`Testing: ${strat.name}`);
  const matched = testStatefulChain(entries, strat.name, strat.init, strat.next);

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
