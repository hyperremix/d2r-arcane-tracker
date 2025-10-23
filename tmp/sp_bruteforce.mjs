// Brute-force PRNG candidate search with unknown zone-id enumeration.
// Finds configs where a consistent bijection from PRNG ids (0..35) to CSV names exists
// that matches all 938 hours exactly.
import { readFileSync } from 'fs';

const CSV_PATH = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const START_ISO = '2023-01-27T00:00:00Z';
const SEED = 16664395743969097666n; // from desecratedzones.json
const ZONE_COUNT = 36;
const HOURS_TO_MATCH = 938;

function parseCsv() {
  const lines = readFileSync(CSV_PATH, 'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map((l) => {
    const parts = l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    return { iso: parts[2], name: parts[3].replace(/^"|"$/g, '') };
  });
}
function hoursSinceStart(targetIso) {
  return Math.floor((new Date(targetIso).getTime() - new Date(START_ISO).getTime()) / 3600000);
}

// unbiased bounded selection
function uniformBoundedU32(nextU32, bound) {
  const B = 0x1_0000_0000n;
  const boundN = BigInt(bound >>> 0);
  const threshold = (B - boundN) % boundN;
  while (true) {
    const r = nextU32();
    const rN = BigInt(r >>> 0);
    if (rN >= threshold) return Number(rN % boundN) >>> 0;
  }
}

// PCG32 XSH-RR
const PCG_MUL = 6364136223846793005n;
function rotr32(x, r) { r &= 31; return ((x >>> r) | (x << ((32 - r) & 31))) >>> 0; }
function pcg32_next(st) {
  const oldstate = st.state;
  st.state = (oldstate * PCG_MUL + st.inc) & 0xFFFF_FFFF_FFFF_FFFFn;
  const xorshifted = Number(((oldstate >> 18n) ^ oldstate) >> 27n) >>> 0;
  const rot = Number(oldstate >> 59n) & 31;
  return rotr32(xorshifted, rot) >>> 0;
}
function pcg32_seed_naive(seed, inc) {
  return { state: seed & 0xFFFF_FFFF_FFFF_FFFFn, inc: inc & 0xFFFF_FFFF_FFFF_FFFFn };
}
function pcg32_seed_recommended(initstate, initseq) {
  const st = { state: 0n, inc: ((initseq << 1n) | 1n) & 0xFFFF_FFFF_FFFF_FFFFn };
  pcg32_next(st);
  st.state = (st.state + (initstate & 0xFFFF_FFFF_FFFF_FFFFn)) & 0xFFFF_FFFF_FFFF_FFFFn;
  pcg32_next(st);
  return st;
}

// LCG64
function lcg64_next(st) {
  st.state = (st.a * st.state + st.c) & 0xFFFF_FFFF_FFFF_FFFFn;
  return Number(st.state >> 32n) >>> 0;
}

// SplitMix64
function splitmix64_next(st) {
  st.state = (st.state + 0x9E3779B97F4A7C15n) & 0xFFFF_FFFF_FFFF_FFFFn;
  let z = st.state;
  z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFF_FFFF_FFFF_FFFFn;
  z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFF_FFFF_FFFF_FFFFn;
  z ^= z >> 31n;
  return Number(z >> 32n) >>> 0;
}

// xorshift128+
function xs128p_init(seed) {
  function splitmix64(x) {
    x = (x + 0x9E3779B97F4A7C15n) & 0xFFFF_FFFF_FFFF_FFFFn; let z = x;
    z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFF_FFFF_FFFF_FFFFn;
    z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFF_FFFF_FFFF_FFFFn;
    z ^= z >> 31n; return z;
  }
  return { s0: splitmix64(seed), s1: splitmix64(seed + 1n) };
}
function xs128p_next(st) {
  let s1 = st.s0; const s0 = st.s1; st.s0 = s0;
  s1 ^= s1 << 23n; s1 &= 0xFFFF_FFFF_FFFF_FFFFn;
  st.s1 = s1 ^ s0 ^ (s1 >> 17n) ^ (s0 >> 26n);
  const res = (st.s1 + s0) & 0xFFFF_FFFF_FFFF_FFFFn;
  return Number(res >> 32n) >>> 0;
}

// xoshiro256**
function rotl(x, k) { return ((x << BigInt(k)) | (x >> (64n - BigInt(k)))) & 0xFFFF_FFFF_FFFF_FFFFn; }
function xoshiro_init(seed) {
  function splitmix64(x) {
    x = (x + 0x9E3779B97F4A7C15n) & 0xFFFF_FFFF_FFFF_FFFFn; let z = x;
    z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFF_FFFF_FFFF_FFFFn;
    z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFF_FFFF_FFFF_FFFFn;
    z ^= z >> 31n; return z;
  }
  return { s: [splitmix64(seed), splitmix64(seed + 1n), splitmix64(seed + 2n), splitmix64(seed + 3n)] };
}
function xoshiro_next(st) {
  const s = st.s;
  const result = (rotl((s[1] * 5n) & 0xFFFF_FFFF_FFFF_FFFFn, 7) * 9n) & 0xFFFF_FFFF_FFFF_FFFFn;
  const out = Number(result >> 32n) >>> 0;
  const t = (s[1] << 17n) & 0xFFFF_FFFF_FFFF_FFFFn;
  s[2] ^= s[0]; s[3] ^= s[1]; s[1] ^= s[2]; s[0] ^= s[3]; s[2] ^= t; s[3] = rotl(s[3], 45);
  return out;
}

function simulateToStart(nextU32, startHour, cfg) {
  for (let i = 0; i < cfg.preWarmup; i++) nextU32();
  const recent = [];
  for (let h = 0; h < startHour; h++) {
    for (let k = 0; k < cfg.perHourSkips; k++) nextU32();
    while (true) {
      const r = cfg.useBounded ? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32() % ZONE_COUNT);
      const id = r >>> 0;
      if (!recent.includes(id)) { recent.push(id); break; }
    }
    if (recent.length > cfg.windowSize) recent.shift();
    for (let k = 0; k < cfg.postHourSkips; k++) nextU32();
  }
  return recent.slice(-cfg.windowSize);
}

function simulateBlock(nextU32, cfg, carryRecent) {
  const recent = carryRecent.slice();
  const out = [];
  for (let h = 0; h < HOURS_TO_MATCH; h++) {
    for (let k = 0; k < cfg.perHourSkips; k++) nextU32();
    let chosen = -1;
    while (true) {
      const r = cfg.useBounded ? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32() % ZONE_COUNT);
      const id = r >>> 0;
      if (!recent.includes(id)) { chosen = id; break; }
    }
    out.push(chosen);
    recent.push(chosen);
    if (recent.length > cfg.windowSize) recent.shift();
    for (let k = 0; k < cfg.postHourSkips; k++) nextU32();
  }
  return out;
}

function canMapToNames(predIds, expectedNames) {
  // Build mapping id->name, ensure consistency and injectivity
  const map = new Map();
  const usedNames = new Set();
  for (let i = 0; i < predIds.length; i++) {
    const id = predIds[i];
    const name = expectedNames[i];
    if (map.has(id)) {
      if (map.get(id) !== name) return null; // conflict
    } else {
      if (usedNames.has(name)) return null; // injectivity violation
      map.set(id, name);
      usedNames.add(name);
    }
  }
  // Ensure coverage: all 36 names must be present in mapping
  if (map.size !== ZONE_COUNT) return null;
  return map;
}

function* prngFactories() {
  // PCG32 variants
  const incs = [
    1442695040888963407n,
    ((SEED << 1n) | 1n) & 0xFFFF_FFFF_FFFF_FFFFn,
    ((SEED ^ (SEED >> 1n)) | 1n) & 0xFFFF_FFFF_FFFF_FFFFn,
  ];
  const seeders = [
    {name:'pcg32-naive', fn:(inc)=>pcg32_seed_naive(SEED, inc)},
    {name:'pcg32-reco', fn:(inc)=>pcg32_seed_recommended(SEED, inc)},
  ];
  for (const inc of incs) for (const seeder of seeders) {
    yield { label:`pcg32 inc=${inc.toString()} ${seeder.name}`, nextU32:()=>{ const st=seeder.fn(inc); return ()=>pcg32_next(st);} };
  }
  // LCG64 variants
  const lcgParams = [
    {a:6364136223846793005n, c:1n},
    {a:6364136223846793005n, c:((SEED|1n)&0xFFFF_FFFF_FFFF_FFFFn)},
    {a:2862933555777941757n, c:3037000493n},
  ];
  for (const p of lcgParams) {
    yield { label:`lcg a=${p.a} c=${p.c}`, nextU32:()=>{ const st={state:SEED, a:p.a, c:p.c & 0xFFFF_FFFF_FFFF_FFFFn}; return ()=>lcg64_next(st);} };
  }
  // SplitMix64
  yield { label:'splitmix64', nextU32:()=>{ const st={state:SEED}; return ()=>splitmix64_next(st);} };
  // xorshift128+
  yield { label:'xorshift128+', nextU32:()=>{ const st=xs128p_init(SEED); return ()=>xs128p_next(st);} };
  // xoshiro256**
  yield { label:'xoshiro256**', nextU32:()=>{ const st=xoshiro_init(SEED); return ()=>xoshiro_next(st);} };
}

function run() {
  const rows = parseCsv();
  const expectedNames = rows.map(r=>r.name).slice(0, HOURS_TO_MATCH);
  const startHour = hoursSinceStart(rows[0].iso);

  const configs = [];
  for (const prng of prngFactories()) {
    for (const useBounded of [false, true]) {
      for (let windowSize of [2, 3]) {
        for (let preWarmup of [0, 8, 16, 32, 64, 128, 256]) {
          for (let perHourSkips of [0, 1, 2, 3, 4, 5, 6]) {
            for (let postHourSkips of [0, 1, 2, 3, 4, 5, 6]) {
              configs.push({ prng, useBounded, windowSize, preWarmup, perHourSkips, postHourSkips });
            }
          }
        }
      }
    }
  }

  let best = { coverage: -1, cfgLabel: '', cfg: null };
  for (const cfg of configs) {
    const nextU32 = cfg.prng.nextU32();
    const carryRecent = simulateToStart(nextU32, startHour, cfg);
    const ids = simulateBlock(nextU32, cfg, carryRecent);
    const mapping = canMapToNames(ids, expectedNames);
    if (mapping) {
      // full match; found bijection and exact match
      console.log(JSON.stringify({ success: true, cfgLabel: cfg.prng.label, cfg: { ...cfg, prng: undefined } }, null, 2));
      return;
    }
  }
  console.log(JSON.stringify({ success: false }, null, 2));
}

run();
