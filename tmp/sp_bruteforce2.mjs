import { readFileSync } from 'fs';

const CSV_PATH = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED = 16664395743969097666n;
const ZONE_COUNT = 36;
const HOURS = 938;

function parseCsv() {
  const lines = readFileSync(CSV_PATH, 'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map((l) => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[3].replace(/^"|"$/g, '')).slice(0, HOURS);
}

function uniformBoundedU32(nextU32, bound) {
  const B = 0x1_0000_0000n; const boundN = BigInt(bound>>>0); const threshold = (B - boundN) % boundN;
  while (true) { const r=nextU32(); const rN=BigInt(r>>>0); if (rN >= threshold) return Number(rN % boundN)>>>0; }
}

// PCG32 XSH-RR
const PCG_MUL = 6364136223846793005n; function rotr32(x,r){r&=31;return ((x>>>r)|(x<<((32-r)&31)))>>>0;}
function pcg32_next(st){ const old=st.state; st.state=(old*PCG_MUL+st.inc)&0xFFFF_FFFF_FFFF_FFFFn; const xs=Number(((old>>18n)^old)>>27n)>>>0; const rot=Number(old>>59n)&31; return rotr32(xs,rot)>>>0;}
function pcg32_seed_naive(seed,inc){ return {state: seed&0xFFFF_FFFF_FFFF_FFFFn, inc: inc&0xFFFF_FFFF_FFFF_FFFFn}; }
function pcg32_seed_reco(initstate,initseq){ const st={state:0n,inc:((initseq<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn}; pcg32_next(st); st.state=(st.state+(initstate&0xFFFF_FFFF_FFFF_FFFFn))&0xFFFF_FFFF_FFFF_FFFFn; pcg32_next(st); return st; }

// LCG64 high32
function lcg64_next(st){ st.state=(st.a*st.state+st.c)&0xFFFF_FFFF_FFFF_FFFFn; return Number(st.state>>32n)>>>0; }

// SplitMix64
function splitmix64_next(st){ st.state=(st.state+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=st.state; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n&0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn&0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return Number(z>>32n)>>>0; }

// xorshift128+
function xs128p_init(seed){ function sm(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n&0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn&0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z;} return {s0:sm(seed), s1:sm(seed+1n)}; }
function xs128p_next(st){ let s1=st.s0; const s0=st.s1; st.s0=s0; s1^=s1<<23n; s1&=0xFFFF_FFFF_FFFF_FFFFn; st.s1=s1^s0^(s1>>17n)^(s0>>26n); const res=(st.s1+s0)&0xFFFF_FFFF_FFFF_FFFFn; return Number(res>>32n)>>>0; }

// xoshiro256**
function rotl(x,k){ return ((x<<BigInt(k))|(x>>(64n-BigInt(k))))&0xFFFF_FFFF_FFFF_FFFFn; }
function xoshiro_init(seed){ function sm(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n&0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn&0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z;} return {s:[sm(seed),sm(seed+1n),sm(seed+2n),sm(seed+3n)]}; }
function xoshiro_next(st){ const s=st.s; const result=(rotl((s[1]*5n)&0xFFFF_FFFF_FFFF_FFFFn,7)*9n)&0xFFFF_FFFF_FFFF_FFFFn; const out=Number(result>>32n)>>>0; const t=(s[1]<<17n)&0xFFFF_FFFF_FFFF_FFFFn; s[2]^=s[0]; s[3]^=s[1]; s[1]^=s[2]; s[0]^=s[3]; s[2]^=t; s[3]=rotl(s[3],45); return out; }

function simulate(nextU32, cfg){
  const out=[]; const recent=[];
  // global warmup
  for(let i=0;i<cfg.preWarmup;i++) nextU32();
  // startOffset hours to discard
  for(let h=0; h<cfg.startOffset; h++){
    for(let k=0;k<cfg.perHourSkips;k++) nextU32();
    while(true){ const r = cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(!recent.includes(id)){ recent.push(id); break; } }
    if(recent.length>cfg.windowSize) recent.shift();
    for(let k=0;k<cfg.postHourSkips;k++) nextU32();
  }
  // now generate block
  for(let h=0; h<HOURS; h++){
    for(let k=0;k<cfg.perHourSkips;k++) nextU32();
    let chosen=-1;
    while(true){ const r = cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(!recent.includes(id)){ chosen=id; break; } }
    out.push(chosen);
    recent.push(chosen);
    if(recent.length>cfg.windowSize) recent.shift();
    for(let k=0;k<cfg.postHourSkips;k++) nextU32();
  }
  return out;
}

function canMap(predIds, names){
  const map=new Map(); const used=new Set();
  for(let i=0;i<predIds.length;i++){
    const id=predIds[i]; const nm=names[i];
    if(map.has(id)){ if(map.get(id)!==nm) return null; }
    else { if(used.has(nm)) return null; map.set(id,nm); used.add(nm); }
  }
  if(map.size!==ZONE_COUNT) return null; return map;
}

function* prngs(){
  // PCG32 variants
  const incs=[1442695040888963407n, ((SEED<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn, ((SEED^(SEED>>1n))|1n)&0xFFFF_FFFF_FFFF_FFFFn];
  for(const inc of incs){ yield { label:`pcg32-naive inc=${inc}`, next: ()=>{ const st=pcg32_seed_naive(SEED,inc); return ()=>pcg32_next(st); } };
                         yield { label:`pcg32-reco inc=${inc}`, next: ()=>{ const st=pcg32_seed_reco(SEED,inc); return ()=>pcg32_next(st); } }; }
  // LCG64 variants
  const lcgPs=[{a:6364136223846793005n,c:1n},{a:6364136223846793005n,c:((SEED|1n)&0xFFFF_FFFF_FFFF_FFFFn)},{a:2862933555777941757n,c:3037000493n}];
  for(const p of lcgPs){ yield { label:`lcg a=${p.a} c=${p.c}`, next: ()=>{ const st={state:SEED,a:p.a,c:p.c&0xFFFF_FFFF_FFFF_FFFFn}; return ()=>lcg64_next(st);} }; }
  // Splitmix
  yield { label:'splitmix64', next: ()=>{ const st={state:SEED}; return ()=>splitmix64_next(st);} };
  // xorshift128+
  yield { label:'xorshift128+', next: ()=>{ const st=xs128p_init(SEED); return ()=>xs128p_next(st);} };
  // xoshiro256**
  yield { label:'xoshiro256**', next: ()=>{ const st=xoshiro_init(SEED); return ()=>xoshiro_next(st);} };
}

function run(){
  const names=parseCsv();
  const configs=[];
  for(const pr of prngs()){
    for(const useBounded of [false,true]){
      for(const windowSize of [2,3,4]){
        for(const startOffset of [...Array(938).keys()]){
          // keep small to manage time
          for(const perHourSkips of [0,1,2]){
            for(const postHourSkips of [0,1,2]){
              configs.push({pr, useBounded, windowSize, startOffset, preWarmup:0, perHourSkips, postHourSkips});
            }
          }
        }
      }
    }
  }
  let best={coverage:-1};
  for(const cfg of configs){
    const nextU32 = cfg.pr.next();
    const ids=simulate(nextU32, cfg);
    const mapping=canMap(ids,names);
    if(mapping){
      console.log(JSON.stringify({ success:true, cfgLabel:cfg.pr.label, cfg:{...cfg, pr:undefined} },null,2));
      return;
    }
  }
  console.log(JSON.stringify({ success:false },null,2));
}

run();
