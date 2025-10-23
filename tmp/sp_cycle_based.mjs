// Cycle-Based Experiments
// Based on constraint solver findings: test 72-hour cycles and gap patterns

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

function hoursSinceStart(isoTime) {
  const start = new Date(START_ISO).getTime();
  const target = new Date(isoTime).getTime();
  return Math.floor((target - start) / (1000 * 60 * 60));
}

// PRNG
function pcg32_next(state, mul = 6364136223846793005n, inc = 1442695040888963407n) {
  const oldstate = state.value;
  state.value = (oldstate * mul + inc) & 0xFFFFFFFFFFFFFFFFn;
  const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
  const rot = Number(oldstate >> 59n) & 31;
  return ((xorshifted >>> rot) | (xorshifted << (32 - rot))) >>> 0;
}

function splitmix64(x) {
  x = (x + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  let z = x;
  z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFFFFFFFFFFFFFFn;
  z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFFFFFFFFFFFFFFn;
  z ^= z >> 31n;
  return Number(z >> 32n) >>> 0;
}

// Strategy 1: 72-hour bag shuffle
function test72HourBag(zones) {
  console.log('Testing: 72-hour bag shuffle (2x 36-zone bags)');

  const BAG_SIZE = 72;
  let matched = 0;
  let lastZone = -1;

  // Generate bags
  const bags = [];
  for (let bagNum = 0; bagNum * BAG_SIZE < zones.length + BAG_SIZE; bagNum++) {
    const bag = [];
    const state = { value: SEED + BigInt(bagNum) };

    // Fisher-Yates shuffle
    const items = Array.from({ length: BAG_SIZE }, (_, i) => i % ZONE_COUNT);
    for (let i = items.length - 1; i > 0; i--) {
      const j = pcg32_next(state) % (i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    bags.push(items);
  }

  // Draw from bags
  for (let i = 0; i < zones.length; i++) {
    const bagIdx = Math.floor(i / BAG_SIZE);
    const inBagIdx = i % BAG_SIZE;
    let zoneId = bags[bagIdx][inBagIdx];

    // Immediate-repeat rejection
    if (zoneId === lastZone && inBagIdx < BAG_SIZE - 1) {
      zoneId = bags[bagIdx][inBagIdx + 1];
    }

    if (zoneId !== zones[i]) {
      break;
    }
    matched++;
    lastZone = zoneId;
  }

  console.log(`   Match: ${matched}/${zones.length} hours (${(matched / zones.length * 100).toFixed(2)}%)`);
  return matched;
}

// Strategy 2: Dynamic bag size based on hour
function testDynamicBag(zones) {
  console.log('Testing: Dynamic bag size (36 + hour%12)');

  let matched = 0;
  let lastZone = -1;
  let currentBag = [];
  let bagPos = 0;

  for (let hour = 0; hour < zones.length; hour++) {
    if (bagPos >= currentBag.length) {
      // Reshuffle
      const bagSize = 36 + (hour % 12);
      currentBag = Array.from({ length: bagSize }, (_, i) => i % ZONE_COUNT);
      const state = { value: SEED + BigInt(hour) };
      for (let i = currentBag.length - 1; i > 0; i--) {
        const j = pcg32_next(state) % (i + 1);
        [currentBag[i], currentBag[j]] = [currentBag[j], currentBag[i]];
      }
      bagPos = 0;
    }

    let zoneId = currentBag[bagPos++];

    // Immediate-repeat rejection
    if (zoneId === lastZone && bagPos < currentBag.length) {
      zoneId = currentBag[bagPos++];
    }

    if (zoneId !== zones[hour]) {
      break;
    }
    matched++;
    lastZone = zoneId;
  }

  console.log(`   Match: ${matched}/${zones.length} hours (${(matched / zones.length * 100).toFixed(2)}%)`);
  return matched;
}

// Strategy 3: Dual-offset PRNG (hour and cycle)
function testDualOffset(zones) {
  console.log('Testing: Dual-offset PRNG (hour + cycle_offset)');

  const CYCLE_LENGTH = 72;
  let matched = 0;
  let lastZone = -1;

  for (let hour = 0; hour < zones.length; hour++) {
    const cycleOffset = Math.floor(hour / CYCLE_LENGTH);
    const hourInCycle = hour % CYCLE_LENGTH;

    const state = SEED + BigInt(hourInCycle) * 1000n + BigInt(cycleOffset);
    const mixed = splitmix64(state);

    let zoneId = mixed % ZONE_COUNT;

    // Immediate-repeat rejection
    if (zoneId === lastZone) {
      const altMixed = splitmix64(state + 1n);
      zoneId = altMixed % ZONE_COUNT;
    }

    if (zoneId !== zones[hour]) {
      break;
    }
    matched++;
    lastZone = zoneId;
  }

  console.log(`   Match: ${matched}/${zones.length} hours (${(matched / zones.length * 100).toFixed(2)}%)`);
  return matched;
}

// Strategy 4: Weighted selection based on gap patterns
// Observed gaps cluster around 23-35 hours, use this as hint
function testWeightedGaps(zones) {
  console.log('Testing: Gap-aware weighted selection');

  let matched = 0;
  let lastZone = -1;
  const lastSeen = new Array(ZONE_COUNT).fill(-1);

  for (let hour = 0; hour < zones.length; hour++) {
    const state = { value: SEED + BigInt(hour) };

    // Get base random zone
    let zoneId = pcg32_next(state) % ZONE_COUNT;

    // Check if gap is too small (< 20 hours) and try another
    const gap = lastSeen[zoneId] >= 0 ? hour - lastSeen[zoneId] : 999;
    if (gap < 20) {
      // Try alternatives
      for (let attempt = 0; attempt < 10; attempt++) {
        const altZone = pcg32_next(state) % ZONE_COUNT;
        const altGap = lastSeen[altZone] >= 0 ? hour - lastSeen[altZone] : 999;
        if (altGap >= 20 && altZone !== lastZone) {
          zoneId = altZone;
          break;
        }
      }
    }

    // Immediate-repeat rejection
    if (zoneId === lastZone) {
      zoneId = pcg32_next(state) % ZONE_COUNT;
    }

    if (zoneId !== zones[hour]) {
      break;
    }

    matched++;
    lastZone = zoneId;
    lastSeen[zoneId] = hour;
  }

  console.log(`   Match: ${matched}/${zones.length} hours (${(matched / zones.length * 100).toFixed(2)}%)`);
  return matched;
}

console.log('=== Cycle-Based Experiments ===\n');
console.log('Based on constraint analysis findings:\n');
console.log('- Autocorrelation at lag 72 slightly above random');
console.log('- Gap clustering around 23-35 hours (mean: 35.9)');
console.log('- 19 forbidden transitions (never observed)\n');

const zones = parseCsv();
console.log(`Loaded ${zones.length} schedule entries\n`);

let bestMatch = 0;
let bestStrategy = '';

const strategies = [
  { name: '72-hour bag', fn: () => test72HourBag(zones) },
  { name: 'Dynamic bag', fn: () => testDynamicBag(zones) },
  { name: 'Dual-offset', fn: () => testDualOffset(zones) },
  { name: 'Gap-aware', fn: () => testWeightedGaps(zones) }
];

for (const strat of strategies) {
  const matched = strat.fn();
  if (matched > bestMatch) {
    bestMatch = matched;
    bestStrategy = strat.name;
  }
}

console.log('\n=== Results ===');
console.log(`Best strategy: ${bestStrategy}`);
console.log(`Best match: ${bestMatch}/${zones.length} hours (${(bestMatch / zones.length * 100).toFixed(2)}%)`);
console.log(bestMatch >= 100 ? '🎉 SUCCESS! Found significant match!' : '❌ No breakthrough');
