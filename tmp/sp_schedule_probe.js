/* Probe single-player TZ schedule hypothesis: PCG32, 64-bit LCG state, fixed inc */
const { readFileSync } = require('fs');

// Constants from desecratedzones.json
const START_ISO = '2023-01-27T00:00:00Z';
const SEED = 16664395743969097666n; // from desecratedzones.json
const DURATION_MIN = 60; // 60 minutes
const BREAK_MIN = 0;     // no break
const TOTAL_MIN_PER_SLOT = DURATION_MIN + BREAK_MIN; // 60
const ZONE_COUNT = 36;

// Candidate PCG32 constants (O'Neill): state_{n+1} = state_n * MUL + INC (mod 2^64)
const MUL = 6364136223846793005n;
const INC = 1442695040888963407n; // must be odd

function rotr32(x, r) {
  r &= 31;
  return ((x >>> r) | (x << ((32 - r) & 31))) >>> 0;
}

function pcg32(state) {
  // Advance state and produce output based on old state
  const oldstate = state.value;
  state.value = (oldstate * MUL + INC) & 0xFFFFFFFFFFFFFFFFn;
  // XSH-RR output function
  const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
  const rot = Number(oldstate >> 59n) & 31;
  const out = rotr32(xorshifted, rot) >>> 0;
  return out;
}

function hoursSinceStart(targetIso) {
  const start = new Date(START_ISO).getTime();
  const target = new Date(targetIso).getTime();
  const diffMs = target - start;
  return Math.floor(diffMs / (TOTAL_MIN_PER_SLOT * 60 * 1000));
}

// Map the 36 group IDs (1..36) to the human-readable names used in the CSV
const idToName = new Map([
  [1, 'Burial Grounds, Crypt, Mausoleum'],
  [2, 'Cathedral, Catacombs'],
  [3, 'Cold Plains, Cave'],
  [4, 'Dark Wood, Underground Passage'],
  [5, 'Blood Moor, Den of Evil'],
  [6, 'Barracks, Jail'],
  [7, 'The Secret Cow Level'], // Moo Moo Farm
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

function generateZoneAtHour(hourIndex, banRepeat = true) {
  const state = { value: SEED };
  let prev = -1;
  let chosen = -1;
  for (let i = 0; i <= hourIndex; i++) {
    // draw until not equal to prev if banRepeat
    while (true) {
      const r = pcg32(state);
      const id = (r % ZONE_COUNT) + 1; // 1..36
      if (!banRepeat || id !== prev) {
        chosen = id;
        break;
      }
      // else re-roll using next RNG value
    }
    prev = chosen;
  }
  return chosen;
}

function test(targetIso, expectedName) {
  const h = hoursSinceStart(targetIso);
  const idNoBan = generateZoneAtHour(h, false);
  const idBan = generateZoneAtHour(h, true);
  const nameNoBan = idToName.get(idNoBan);
  const nameBan = idToName.get(idBan);
  console.log(JSON.stringify({ targetIso, hours: h, idNoBan, nameNoBan, idBan, nameBan, expectedName }, null, 2));
}

// Use first few rows from provided CSV to probe
const probes = [
  ['2025-09-27T22:00:00Z', 'Arreat Plateau, Pit of Acheron'],
  ['2025-09-27T23:00:00Z', 'Bloody Foothills, Frigid Highlands, Abaddon'],
  ['2025-09-28T00:00:00Z', 'Spider Forest, Spider Cavern'],
  ['2025-09-28T01:00:00Z', 'Lost City, Valley of Snakes, Claw Viper Temple'],
  ['2025-09-28T02:00:00Z', 'Flayer Jungle, Flayer Dungeon'],
];

for (const [iso, name] of probes) test(iso, name);
