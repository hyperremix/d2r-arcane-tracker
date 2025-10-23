import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED = 16664395743969097666n; // base 64-bit seed
const ZONE_COUNT = 36;

function parseCSVLine(line){ const fields=[]; let curr=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(inQ){ if(ch==='"'){ if(i+1<line.length && line[i+1]==='"'){ curr+='"'; i++; } else { inQ=false; } } else { curr+=ch; } } else { if(ch==='"'){ inQ=true; } else if(ch===','){ fields.push(curr); curr=''; } else { curr+=ch; } } } fields.push(curr); return fields; }
function parseCsv(){ const raw=readFileSync(CSV,'utf8'); const lines=raw.trim().split(/\r?\n/); const header=parseCSVLine(lines[0]); const dtIdx=header.findIndex(h=>/date|time|datetime/i.test(h)); const nameIdx=header.findIndex(h=>/zone/i.test(h)); const rows=lines.slice(1).map(parseCSVLine).filter(r=>r.length>nameIdx); const names=rows.map(r=>r[nameIdx]); const dts=rows.map(r=>r[dtIdx]); return {names,dts}; }

const idToName=[ 'Burial Grounds, Crypt, Mausoleum','Cathedral, Catacombs','Cold Plains, Cave','Dark Wood, Underground Passage','Blood Moor, Den of Evil','Barracks, Jail','The Secret Cow Level','Stony Field','Black Marsh, The Hole','Forgotten Tower','Pit','Tristram','Lut Gholein Sewers','Rocky Waste, Stony Tomb','Dry Hills, Halls of the Dead','Far Oasis','Lost City, Valley of Snakes, Claw Viper Temple','Ancient Tunnels',"Tal Rasha's Tombs, Tal Rasha's Chamber",'Arcane Sanctuary','Spider Forest, Spider Cavern','Great Marsh','Flayer Jungle, Flayer Dungeon','Kurast Bazaar, Ruined Temple, Disused Fane','Travincal','Durance of Hate','Outer Steppes, Plains of Despair','City of the Damned, River of Flame','Chaos Sanctuary','Bloody Foothills, Frigid Highlands, Abaddon','Arreat Plateau, Pit of Acheron','Crystalline Passage, Frozen River',"Nihlathak's Temple, Temple Halls",'Glacial Trail, Drifter Cavern',"Ancient's Way, Icy Cellar",'Worldstone Keep, Throne of Destruction, Worldstone Chamber'];
const nameToId=new Map(idToName.map((n,i)=>[n,i]));

function uniformBoundedU32(nextU32, bound){ const B=0x1_0000_0000n; const boundN=BigInt(bound>>>0); const threshold=(B-boundN)%boundN; while(true){ const r=nextU32(); const rN=BigInt(r>>>0); if(rN>=threshold) return Number(rN%boundN)>>>0; } }

// Mixers
function splitmix64_step(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n & 0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn & 0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z; }
function wyhash64mix(x){ x^=x>>32n; x=(x*0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; x^=x>>29n; x=(x*0xBF58476D1CE4E5B9n)&0xFFFF_FFFF_FFFF_FFFFn; x^=x>>32n; return x; }
function jenkins64(x){ x^=x>>33n; x=(x*0xff51afd7ed558ccdn)&0xFFFF_FFFF_FFFF_FFFFn; x^=x>>33n; x=(x*0xc4ceb9fe1a85ec53n)&0xFFFF_FFFF_FFFF_FFFFn; x^=x>>33n; return x; }

// PCG32 core
const PCG_MUL = 6364136223846793005n;
function pcg32_step(st){ st.state = (st.state * st.mul + st.inc) & 0xFFFF_FFFF_FFFF_FFFFn; }
function pcg32_seed(initstate, initseq, mul){ const st={state:0n,inc:((initseq<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn,mul}; pcg32_step(st); st.state=(st.state + (initstate&0xFFFF_FFFF_FFFF_FFFFn)) & 0xFFFF_FFFF_FFFF_FFFFn; pcg32_step(st); return st; }
function rotr32(x,r){ r&=31; return ((x>>>r)|(x<<((32-r)&31)))>>>0; }
function o_xsh_rr(st){ const old=st.state; pcg32_step(st); const xorshifted=Number(((old>>18n)^old)>>27n)>>>0; const rot=Number(old>>59n)&31; return rotr32(xorshifted, rot); }

// Jump-ahead helpers (naive draw skipping): advance state by J draws
function jumpAhead(nextU32, J){ for(let i=0;i<J;i++) nextU32(); }

function simulatePrefix(nextU32, names, cfg){
  let matched=0; let last=-1; const N=names.length;
  // Optional seed-mix with hour/day
  if(cfg.seedWarmMix>0){ for(let i=0;i<cfg.seedWarmMix;i++) nextU32(); }
  for(let h=0; h<N; h++){
    if(cfg.jumpStride>0){ jumpAhead(nextU32, cfg.jumpStride); }
    let chosen=-1; let nonRepeatSeen=0; let attempts=0;
    // Multi-draw pick K among D
    if(cfg.drawsPerHour>1 && cfg.pickKNonRepeat>=0){
      for(let d=0; d<cfg.drawsPerHour; d++){
        const r = cfg.selMethod===0? (nextU32()%ZONE_COUNT) : uniformBoundedU32(nextU32, ZONE_COUNT);
        const id=r>>>0;
        if(id!==last){ if(nonRepeatSeen===cfg.pickKNonRepeat){ chosen=id; break; } nonRepeatSeen++; }
      }
    }
    // Retry-until-nonrepeat with limit
    while(chosen===-1){ const r = cfg.selMethod===0? (nextU32()%ZONE_COUNT) : uniformBoundedU32(nextU32, ZONE_COUNT); const id=r>>>0; attempts++; if(id!==last || (cfg.retryLimit>0 && attempts>=cfg.retryLimit)){ chosen=id; break; } }
    const expected=nameToId.get(names[h]); if(chosen!==expected) return matched; matched++; last=chosen;
  }
  return matched;
}

function* makeFactories(){
  // multiple seed derivations chained
  const seeders=[
    () => ({initstate:SEED, initseq:SEED}),
    () => { const a=splitmix64_step(SEED); return {initstate:a, initseq:SEED^a}; },
    () => { const a=splitmix64_step(SEED), b=splitmix64_step(a); return {initstate:b, initseq:a}; },
    () => { const a=wyhash64mix(SEED); return {initstate:a, initseq:jenkins64(SEED)}; },
  ];
  const muls=[PCG_MUL, 15750249268501108917n, 12605985483714917081n];
  for(const se of seeders){ const {initstate, initseq}=se(); for(const mul of muls){ yield {label:`pcg32 xsh-rr mul=${mul}`, next:()=>{ const st=pcg32_seed(initstate, initseq, mul); return ()=>o_xsh_rr(st);} }; } }
}

function run(){
  const {names}=parseCsv();
  const families=[...makeFactories()];
  let best={prefix:0};
  for(const fam of families){
    for(const selMethod of [0,1]){
      for(const seedWarmMix of [0,1,2,4,8]){
        for(const jumpStride of [0,1,2,3,4,6,8,12,16]){
          for(const drawsPerHour of [1,2,3,4]){
            for(const pickKNonRepeat of [-1,0,1,2]){
              for(const retryLimit of [0,1,2,3,5]){
                const nextU32=fam.next();
                const prefix=simulatePrefix(nextU32, names, {selMethod, seedWarmMix, jumpStride, drawsPerHour, pickKNonRepeat, retryLimit});
                if(prefix>best.prefix){ best={prefix, label:fam.label, cfg:{selMethod, seedWarmMix, jumpStride, drawsPerHour, pickKNonRepeat, retryLimit}}; if(prefix===names.length){ console.log(JSON.stringify({success:true,best},null,2)); return; } }
              }
            }
          }
        }
      }
    }
  }
  console.log(JSON.stringify({success:false,best},null,2));
}

run();
