import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED = 16664395743969097666n;
const ZONE_COUNT = 36;

function parseCSVLine(line){ const fields=[]; let curr=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(inQ){ if(ch==='"'){ if(i+1<line.length && line[i+1]==='"'){ curr+='"'; i++; } else { inQ=false; } } else { curr+=ch; } } else { if(ch==='"'){ inQ=true; } else if(ch===','){ fields.push(curr); curr=''; } else { curr+=ch; } } } fields.push(curr); return fields; }
function parseCsvNames(){ const raw=readFileSync(CSV,'utf8'); const lines=raw.trim().split(/\r?\n/); const header=parseCSVLine(lines[0]); const nameIdx=header.findIndex(h=>/zone/i.test(h)); const rows=lines.slice(1).map(parseCSVLine).filter(r=>r.length>nameIdx); const names=rows.map(r=>r[nameIdx]); return names; }
const idToName=[ 'Burial Grounds, Crypt, Mausoleum','Cathedral, Catacombs','Cold Plains, Cave','Dark Wood, Underground Passage','Blood Moor, Den of Evil','Barracks, Jail','The Secret Cow Level','Stony Field','Black Marsh, The Hole','Forgotten Tower','Pit','Tristram','Lut Gholein Sewers','Rocky Waste, Stony Tomb','Dry Hills, Halls of the Dead','Far Oasis','Lost City, Valley of Snakes, Claw Viper Temple','Ancient Tunnels',"Tal Rasha's Tombs, Tal Rasha's Chamber",'Arcane Sanctuary','Spider Forest, Spider Cavern','Great Marsh','Flayer Jungle, Flayer Dungeon','Kurast Bazaar, Ruined Temple, Disused Fane','Travincal','Durance of Hate','Outer Steppes, Plains of Despair','City of the Damned, River of Flame','Chaos Sanctuary','Bloody Foothills, Frigid Highlands, Abaddon','Arreat Plateau, Pit of Acheron','Crystalline Passage, Frozen River',"Nihlathak's Temple, Temple Halls",'Glacial Trail, Drifter Cavern',"Ancient's Way, Icy Cellar",'Worldstone Keep, Throne of Destruction, Worldstone Chamber'];
const nameToId=new Map(idToName.map((n,i)=>[n,i]));

function uniformBoundedU32(nextU32, bound){ const B=0x1_0000_0000n; const boundN=BigInt(bound>>>0); const threshold=(B-boundN)%boundN; while(true){ const r=nextU32(); const rN=BigInt(r>>>0); if(rN>=threshold) return Number(rN%boundN)>>>0; } }

// SplitMix64 step (for seed derivations)
function splitmix64_step(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n & 0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn & 0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z; }

// PCG32 core (64-bit state)
const PCG_MUL = 6364136223846793005n;
function pcg32_step(st){ st.state = (st.state * st.mul + st.inc) & 0xFFFF_FFFF_FFFF_FFFFn; }
function pcg32_seed_naive(seed, inc, mul=PCG_MUL){ return { state: seed & 0xFFFF_FFFF_FFFF_FFFFn, inc: inc & 0xFFFF_FFFF_FFFF_FFFFn, mul }; }
function pcg32_seed_recommended(initstate, initseq, mul=PCG_MUL){ const st={ state:0n, inc: ((initseq<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn, mul}; pcg32_step(st); st.state=(st.state + (initstate & 0xFFFF_FFFF_FFFF_FFFFn)) & 0xFFFF_FFFF_FFFF_FFFFn; pcg32_step(st); return st; }
// Outputs
function pcg32_xsh_rr(st){ const old=st.state; pcg32_step(st); const xorshifted = Number(((old>>18n)^old)>>27n)>>>0; const rot = Number(old>>59n)&31; return ((xorshifted>>>rot) | (xorshifted<<(32-rot)))>>>0; }
function pcg32_xsl_rr(st){ const old=st.state; pcg32_step(st); const xorshifted = Number(((old>>5n)^old)>>27n)>>>0; const rot = Number(old>>58n)&31; return ((xorshifted>>>rot) | (xorshifted<<(32-rot)))>>>0; }
function pcg32_rxs_m_xs(st){ const old=st.state; pcg32_step(st); let x = Number(((old>>22n)^old)&0xFFFF_FFFFn)>>>0; x = Math.imul(x, 0x85ebca6b)>>>0; x ^= x>>>13; const rot = Number(old>>61n)&31; return ((x>>>rot) | (x<<(32-rot)))>>>0; }
function pcg32_dxsm_like(st){ const old=st.state; pcg32_step(st); let x = Number(((old>>32n) ^ old) & 0xFFFF_FFFFn)>>>0; x = Math.imul(x, 0xc2b2ae35)>>>0; x ^= x>>>16; return x>>>0; }

// "PCG64-like" using 64-bit state and 64-bit outputs then fold to 32
function pcg64_next_dxsm(st){ const old=st.state; st.state = (st.state * st.mul + st.inc) & 0xFFFF_FFFF_FFFF_FFFFn; let x = old; x ^= x>>32n; x = (x * 0x9E3779B97F4A7C15n) & 0xFFFF_FFFF_FFFF_FFFFn; x ^= x>>29n; return Number(x>>32n)>>>0; }

function simulatePrefixWithJump(nextU32, names, cfg){
  let matched=0; let last=-1;
  for(let i=0;i<cfg.preWarmup;i++) nextU32();
  for(let a=0;a<cfg.alignOffset;a++) nextU32();
  for(let h=0; h<names.length; h++){
    let sel=-1; let seen=0;
    for(let d=0; d<cfg.drawsPerHour; d++){
      const r= cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0;
      if(id!==last){ if(seen===cfg.selectionIndex){ sel=id; } seen++; if(sel!==-1) break; }
    }
    if(sel===-1){ while(true){ const r= cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(id!==last){ sel=id; break; } } }
    const expected=nameToId.get(names[h]);
    if(sel!==expected) return matched;
    matched++; last=sel;
  }
  return matched;
}

function* pcg32Factories(){
  const incs=[1442695040888963407n, ((SEED<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn, (splitmix64_step(SEED)|1n)&0xFFFF_FFFF_FFFF_FFFFn];
  const muls=[PCG_MUL, 15750249268501108917n];
  const outputs=[pcg32_xsh_rr, pcg32_xsl_rr, pcg32_rxs_m_xs, pcg32_dxsm_like];
  const seeders=[(inc,mul)=>pcg32_seed_naive(SEED,inc,mul),(inc,mul)=>pcg32_seed_recommended(SEED,inc,mul)];
  for(const mul of muls) for(const inc of incs) for(const seeder of seeders) for(const outFn of outputs){
    yield { label:`pcg32 mul=${mul} inc=${inc} out=${outFn.name} ${seeder===seeders[0]?'naive':'reco'}`, make: ()=>{ const st=seeder(inc,mul); return ()=>outFn(st); } };
  }
}

function* pcg64Factories(){
  const incs=[1442695040888963407n, ((SEED<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn, (splitmix64_step(SEED)|1n)&0xFFFF_FFFF_FFFF_FFFFn];
  const muls=[6364136223846793005n, 15750249268501108917n];
  for(const mul of muls) for(const inc of incs){
    yield { label:`pcg64-like mul=${mul} inc=${inc} dxsm`, make: ()=>{ const st={state:SEED&0xFFFF_FFFF_FFFF_FFFFn, inc:inc&0xFFFF_FFFF_FFFF_FFFFn, mul}; return ()=>pcg64_next_dxsm(st); } };
  }
}

function run(){
  const names=parseCsvNames();
  const preWarmups=[0,1,2,4,8,16,32,64];
  const drawsPerHour=[1,2,3,4,6,8];
  const selectionIndex=[0,1,2,3];
  const alignOffsets=[0,1,2,4,8,16,32,64,128];
  const useBoundedOpts=[false,true];
  let best={prefix:0};
  const families=[...pcg32Factories(), ...pcg64Factories()];
  for(const fam of families){
    for(const pre of preWarmups){
      for(const dph of drawsPerHour){
        for(const sel of selectionIndex){ if(sel>=dph) continue; 
          for(const align of alignOffsets){
            for(const useBounded of useBoundedOpts){
              const nextU32=fam.make();
              const prefix=simulatePrefixWithJump(nextU32, names, {preWarmup:pre, drawsPerHour:dph, selectionIndex:sel, alignOffset:align, useBounded});
              if(prefix>best.prefix){ best={prefix, label:fam.label, preWarmup:pre, drawsPerHour:dph, selectionIndex:sel, alignOffset:align, useBounded}; if(prefix===names.length){ console.log(JSON.stringify({success:true,best},null,2)); return; } }
            }
          }
        }
      }
    }
  }
  console.log(JSON.stringify({success:false,best},null,2));
}

run();
