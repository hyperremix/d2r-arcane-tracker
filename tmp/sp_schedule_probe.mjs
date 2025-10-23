// Probe single-player TZ schedule hypothesis: PRNG-based selection over 36 zone groups

// Constants from desecratedzones.json
const START_ISO = '2023-01-27T00:00:00Z';
const SEED = 16664395743969097666n; // from desecratedzones.json
const DURATION_MIN = 60; // 60 minutes
const BREAK_MIN = 0;     // no break
const TOTAL_MIN_PER_SLOT = DURATION_MIN + BREAK_MIN; // 60
const ZONE_COUNT = 36;

// Candidate PCG32 constants (O'Neill): state_{n+1} = state_n * MUL + INC (mod 2^64)
const MUL = 6364136223846793005n;
const INC_DEFAULT = 1442695040888963407n; // must be odd

function rotr32(x, r) {
  r &= 31;
  return ((x >>> r) | (x << ((32 - r) & 31))) >>> 0;
}

function pcg32_next(state, mul, inc) {
  const oldstate = state.value;
  state.value = (oldstate * mul + inc) & 0xFFFFFFFFFFFFFFFFn;
  const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
  const rot = Number(oldstate >> 59n) & 31;
  const out = rotr32(xorshifted, rot) >>> 0;
  return out;
}

function lcg64_next(state, a, c) {
  const old = state.value;
  state.value = (old * a + c) & 0xFFFFFFFFFFFFFFFFn;
  return Number(state.value >> 32n) >>> 0; // take high 32 bits
}

function splitmix64_next(state) {
  // from Steele et al. SplitMix64
  state.value = (state.value + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  let z = state.value;
  z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFFFFFFFFFFFFFFn;
  z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFFFFFFFFFFFFFFn;
  z ^= z >> 31n;
  return Number(z >> 32n) >>> 0; // use high 32
}

function xorshift64star_next(state) {
  let x = state.value;
  x ^= x << 13n; x &= 0xFFFFFFFFFFFFFFFFn;
  x ^= x >> 7n;
  x ^= x << 17n; x &= 0xFFFFFFFFFFFFFFFFn;
  state.value = x;
  // * multiplier 2685821657736338717 (xorshift64*)
  const out = (x * 2685821657736338717n) & 0xFFFFFFFFFFFFFFFFn;
  return Number(out >> 32n) >>> 0;
}

function hoursSinceStart(targetIso) {
  const start = new Date(START_ISO).getTime();
  const target = new Date(targetIso).getTime();
  const diffMs = target - start;
  return Math.floor(diffMs / (TOTAL_MIN_PER_SLOT * 60 * 1000));
}

const idToName = new Map([
  [1, 'Burial Grounds, Crypt, Mausoleum'],
  [2, 'Cathedral, Catacombs'],
  [3, 'Cold Plains, Cave'],
  [4, 'Dark Wood, Underground Passage'],
  [5, 'Blood Moor, Den of Evil'],
  [6, 'Barracks, Jail'],
  [7, 'The Secret Cow Level'],
  [8, 'Stony Field'],
  [9, 'Black Marsh, The Hole'],
  [10, 'Forgotten Tower'],
  [11, 'Pit'],
  [12, 'Tristram'],
  [13, 'Lut Gholein Sewers'],
  [14, 'Rocky Waste, Stony Tomb'],
  [15, 'Dry Hills, Halls of the Dead'],
  [16, 'Far Oasis'],
  [17, 'Lost City, Valley of Snakes, Claw Viper Temple'],
  [18, 'Ancient Tunnels'],
  [19, "Tal Rasha's Tombs, Tal Rasha's Chamber"],
  [20, 'Arcane Sanctuary'],
  [21, 'Spider Forest, Spider Cavern'],
  [22, 'Great Marsh'],
  [23, 'Flayer Jungle, Flayer Dungeon'],
  [24, 'Kurast Bazaar, Ruined Temple, Disused Fane'],
  [25, 'Travincal'],
  [26, 'Durance of Hate'],
  [27, 'Outer Steppes, Plains of Despair'],
  [28, 'City of the Damned, River of Flame'],
  [29, 'Chaos Sanctuary'],
  [30, 'Bloody Foothills, Frigid Highlands, Abaddon'],
  [31, 'Arreat Plateau, Pit of Acheron'],
  [32, 'Crystalline Passage, Frozen River'],
  [33, "Nihlathak's Temple, Temple Halls"],
  [34, 'Glacial Trail, Drifter Cavern'],
  [35, "Ancient's Way, Icy Cellar"],
  [36, 'Worldstone Keep, Throne of Destruction, Worldstone Chamber'],
]);

function simulate(generator, hours, opts = { banRepeat: true, banWindow: 1 }) {
  const state = { value: SEED };
  const recent = [];
  let chosen = -1;
  for (let i = 0; i <= hours; i++) {
    while (true) {
      const r = generator(state);
      const id = (r % ZONE_COUNT) + 1;
      if (!opts.banRepeat) { chosen = id; break; }
      const banned = recent.includes(id);
      if (!banned) { chosen = id; break; }
    }
    recent.push(chosen);
    if (recent.length > (opts.banWindow ?? 1)) recent.shift();
  }
  return chosen;
}

function testOne(targetIso, expectedName) {
  const h = hoursSinceStart(targetIso);
  const candidates = {
    pcg32_default_inc: (s) => pcg32_next(s, MUL, INC_DEFAULT),
    pcg32_inc_seed: (s) => pcg32_next(s, MUL, (SEED | 1n)),
    lcg64_ms: (s) => lcg64_next(s, 6364136223846793005n, 1n),
    splitmix64: (s) => splitmix64_next(s),
    xorshift64star: (s) => xorshift64star_next(s),
  };
  const out = {};
  for (const [name, gen] of Object.entries(candidates)) {
    const idNoBan = simulate(gen, h, { banRepeat: false, banWindow: 1 });
    const idBan1 = simulate(gen, h, { banRepeat: true, banWindow: 1 });
    const idBan3 = simulate(gen, h, { banRepeat: true, banWindow: 3 });
    const idBan5 = simulate(gen, h, { banRepeat: true, banWindow: 5 });
    out[name] = {
      idNoBan, nameNoBan: idToName.get(idNoBan),
      idBan1, nameBan1: idToName.get(idBan1),
      idBan3, nameBan3: idToName.get(idBan3),
      idBan5, nameBan5: idToName.get(idBan5),
    };
  }
  return { targetIso, hours: h, expectedName, out };
}

const probes = [
  ['2025-09-27T22:00:00Z', 'Arreat Plateau, Pit of Acheron'],
  ['2025-09-27T23:00:00Z', 'Bloody Foothills, Frigid Highlands, Abaddon'],
  ['2025-09-28T00:00:00Z', 'Spider Forest, Spider Cavern'],
  ['2025-09-28T01:00:00Z', 'Lost City, Valley of Snakes, Claw Viper Temple'],
  ['2025-09-28T02:00:00Z', 'Flayer Jungle, Flayer Dungeon'],
];

const results = probes.map(([iso, name]) => testOne(iso, name));
console.log(JSON.stringify(results, null, 2));
