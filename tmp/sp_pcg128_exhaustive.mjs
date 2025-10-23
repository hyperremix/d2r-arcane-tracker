import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED = 16664395743969097666n;
const ZONE_COUNT = 36;

function parseCSVLine(line){ const fields=[]; let curr=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(inQ){ if(ch==='"'){ if(i+1<line.length && line[i+1]==='"'){ curr+='"'; i++; } else { inQ=false; } } else { curr+=ch; } } else { if(ch==='"'){ inQ=true; } else if(ch===','){ fields.push(curr); curr=''; } else { curr+=ch; } } } fields.push(curr); return fields; }
function parseCsvNames(){ const raw=readFileSync(CSV,'utf8'); const lines=raw.trim().split(/\r?\n/); const header=parseCSVLine(lines[0]); const nameIdx=header.findIndex(h=>/zone/i.test(h)); const rows=lines.slice(1).map(parseCSVLine).filter(r=>r.length>nameIdx); const names=rows.map(r=>r[nameIdx]); return names; }
const idToName=[ 'Burial Grounds, Crypt, Mausoleum','Cathedral, Catacombs','Cold Plains, Cave','Dark Wood, Underground Passage','Blood Moor, Den of Evil','Barracks, Jail','The Secret Cow Level','Stony Field','Black Marsh, The Hole','Forgotten Tower','Pit','Tristram','Lut Gholein Sewers','Rocky Waste, Stony Tomb','Dry Hills, Halls of the Dead','Far Oasis','Lost City, Valley of Snakes, Claw Viper Temple','Ancient Tunnels',"Tal Rasha's Tombs, Tal Rasha's Chamber",'Arcane Sanctuary','Spider Forest, Spider Cavern','Great Marsh','Flayer Jungle, Flayer Dungeon','Kurast Bazaar, Ruined Temple, Disused Fane','Travincal','Durance of Hate','Outer Steppes, Plains of Despair','City of the Damned, River of Flame','Chaos Sanctuary','Bloody Foothills, Frigid Highlands, Abaddon','Arreat Plateau, Pit of Acheron','Crystalline Passage, Frozen River',"Nihlathak's Temple, Temple Halls",'Glacial Trail, Drifter Cavern',"Ancient's Way, Icy Cellar",'Worldstone Keep, Throne of Destruction, Worldstone Chamber'];
const nameToId=new Map(idToName.map((n,i)=>[n,i]));

function uniformBoundedU32(nextU32, bound){ const B=0x1_0000_0000n; const boundN=BigInt(bound>>>0); const threshold=(B-boundN)%boundN; while(true){ const r=nextU32(); const rN=BigInt(r>>>0); if(rN>=threshold) return Number(rN%boundN)>>>0; } }

function splitmix64_step(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n & 0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn & 0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z; }

// 128-bit helpers
const MASK128 = (1n<<128n) - 1n;
function mul128(a,b){ return (a*b) & MASK128; }
function add128(a,b){ return (a+b) & MASK128; }
function rotr64(x, r){ r&=63; return ((x>>BigInt(r)) | (x<<BigInt((64-r)&63))) & ((1n<<64n)-1n); }

// PCG XSL RR 128/64 (variants: use old or new state for output calc)
function pcg128_seed(initstate, initseq, mul){
  let st=0n; let inc = (initseq<<1n)|1n; inc &= MASK128;
  // advance once
  st = add128(mul128(st, mul), inc);
  st = add128(st, initstate & MASK128);
  st = add128(mul128(st, mul), inc);
  return {state: st, inc, mul};
}
function pcg128_step(st){ st.state = add128(mul128(st.state, st.mul), st.inc); }
function pcg128_xsl_rr_old(st){ const old=st.state; pcg128_step(st); const hi = (old>>64n) & ((1n<<64n)-1n); const xorshifted = (hi ^ old) >> 64n; const rot = old >> 122n; const out = rotr64(xorshifted & ((1n<<64n)-1n), Number(rot & 63n)); return Number(out>>32n)>>>0; }
function pcg128_xsl_rr_new(st){ pcg128_step(st); const cur=st.state; const hi = (cur>>64n) & ((1n<<64n)-1n); const xorshifted = (hi ^ cur) >> 64n; const rot = cur >> 122n; const out = rotr64(xorshifted & ((1n<<64n)-1n), Number(rot & 63n)); return Number(out>>32n)>>>0; }

// PCG 64/32 RXS-M-XS (parameterized)
const PCG64_MULS=[6364136223846793005n,15750249268501108917n];
function pcg64_seed(initstate, initseq, mul){ let st=0n; let inc=(initseq<<1n)|1n; inc&=0xFFFF_FFFF_FFFF_FFFFn; st=(st*mul + inc)&0xFFFF_FFFF_FFFF_FFFFn; st=(st + (initstate & 0xFFFF_FFFF_FFFF_FFFFn))&0xFFFF_FFFF_FFFF_FFFFn; st=(st*mul + inc)&0xFFFF_FFFF_FFFF_FFFFn; return {state:st, inc, mul}; }
function pcg64_step(st){ st.state = (st.state * st.mul + st.inc) & 0xFFFF_FFFF_FFFF_FFFFn; }
function pcg64_rxsmxs(st, shr1=22n, mulC=0x5851f42d4c957f2dn, shr2=27){ const old=st.state; pcg64_step(st); let x = (old ^ (old>>shr1)) & 0xFFFF_FFFF_FFFF_FFFFn; x = (x * mulC) & 0xFFFF_FFFF_FFFF_FFFFn; x ^= x >> BigInt(shr2); const rot = old >> 59n; const x32 = Number(x & 0xFFFF_FFFFn)>>>0; const r = Number(rot & 31n); return ((x32>>>r) | (x32<<(32-r)))>>>0; }

function simulatePrefix(nextU32, names, cfg){ let last=-1; let matched=0; for(let i=0;i<cfg.preWarmup;i++) nextU32(); for(let a=0;a<cfg.alignOffset;a++) nextU32(); for(let h=0; h<names.length; h++){
  let sel=-1; let seen=0; for(let d=0; d<cfg.drawsPerHour; d++){ const r= cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(id!==last){ if(seen===cfg.selectionIndex){ sel=id; } seen++; if(sel!==-1) break; } }
  if(sel===-1){ while(true){ const r= cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(id!==last){ sel=id; break; } } }
  const expected=nameToId.get(names[h]); if(sel!==expected) return matched; matched++; last=sel; } return matched; }

function* pcg128Factories(){
  const muls=[0x2360ed051fc65da44385df649fccf645n, 0x9fb21c651e98df25a4f7c3c41d1c2b69n];
  const initseqs=[SEED, splitmix64_step(SEED), SEED ^ (SEED>>1n)];
  for(const mul of muls) for(const initseq of initseqs){
    yield {label:`pcg128-xslrr-old mul=${mul.toString(16)} seq=${initseq}`, make:()=>{ const st=pcg128_seed(SEED, initseq, mul); return ()=>pcg128_xsl_rr_old(st); }};
    yield {label:`pcg128-xslrr-new mul=${mul.toString(16)} seq=${initseq}`, make:()=>{ const st=pcg128_seed(SEED, initseq, mul); return ()=>pcg128_xsl_rr_new(st); }};
  }
}

function* pcg64Factories(){
  const initseqs=[SEED & 0xFFFF_FFFF_FFFF_FFFFn, splitmix64_step(SEED)&0xFFFF_FFFF_FFFF_FFFFn, (SEED^(SEED>>1n))&0xFFFF_FFFF_FFFF_FFFFn];
  const rxParams=[ [22n,0x5851f42d4c957f2dn,27], [27n,0xda942042e4dd58b5n,13], [18n,0x94d049bb133111ebn,19] ];
  for(const mul of PCG64_MULS) for(const initseq of initseqs) for(const [s1,m,s2] of rxParams){
    yield {label:`pcg64-rxsmxs mul=${mul} seq=${initseq} params=${s1.toString()}/${m.toString(16)}/${s2}`, make:()=>{ const st=pcg64_seed(SEED, initseq, mul); return ()=>pcg64_rxsmxs(st,s1,m,s2); }};
  }
}

function run(){
  const names=parseCsvNames();
  const preWarmups=[0,1,2,4,8,16,32];
  const drawsPerHour=[1,2,3,4,6,8];
  const selectionIndex=[0,1,2,3];
  const alignOffsets=[0,1,2,4,8,16,32,64,128,256];
  const useBoundedOpts=[false,true];
  let best={prefix:0};
  const families=[...pcg128Factories(), ...pcg64Factories()];
  for(const fam of families){
    for(const pre of preWarmups){
      for(const dph of drawsPerHour){
        for(const sel of selectionIndex){ if(sel>=dph) continue;
          for(const align of alignOffsets){
            for(const useBounded of useBoundedOpts){
              const nextU32=fam.make();
              const prefix=simulatePrefix(nextU32, names, {preWarmup:pre, drawsPerHour:dph, selectionIndex:sel, alignOffset:align, useBounded});
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
