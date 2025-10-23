import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED = 16664395743969097666n;
const ZONE_COUNT = 36;

function parseCSVLine(line){ const fields=[]; let curr=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(inQ){ if(ch==='"'){ if(i+1<line.length && line[i+1]==='"'){ curr+='"'; i++; } else { inQ=false; } } else { curr+=ch; } } else { if(ch==='"'){ inQ=true; } else if(ch===','){ fields.push(curr); curr=''; } else { curr+=ch; } } } fields.push(curr); return fields; }
function parseCsv(){ const raw=readFileSync(CSV,'utf8'); const lines=raw.trim().split(/\r?\n/); const header=parseCSVLine(lines[0]); const dtIdx=header.findIndex(h=>/date/i.test(h)||/time/i.test(h)||/datetime/i.test(h)); const nameIdx=header.findIndex(h=>/zone/i.test(h)); const rows=lines.slice(1).map(parseCSVLine).filter(r=>r.length>nameIdx); const names=rows.map(r=>r[nameIdx]); const dts=rows.map(r=>r[dtIdx]); return {names, dts}; }

const idToName=[ 'Burial Grounds, Crypt, Mausoleum','Cathedral, Catacombs','Cold Plains, Cave','Dark Wood, Underground Passage','Blood Moor, Den of Evil','Barracks, Jail','The Secret Cow Level','Stony Field','Black Marsh, The Hole','Forgotten Tower','Pit','Tristram','Lut Gholein Sewers','Rocky Waste, Stony Tomb','Dry Hills, Halls of the Dead','Far Oasis','Lost City, Valley of Snakes, Claw Viper Temple','Ancient Tunnels',"Tal Rasha's Tombs, Tal Rasha's Chamber",'Arcane Sanctuary','Spider Forest, Spider Cavern','Great Marsh','Flayer Jungle, Flayer Dungeon','Kurast Bazaar, Ruined Temple, Disused Fane','Travincal','Durance of Hate','Outer Steppes, Plains of Despair','City of the Damned, River of Flame','Chaos Sanctuary','Bloody Foothills, Frigid Highlands, Abaddon','Arreat Plateau, Pit of Acheron','Crystalline Passage, Frozen River',"Nihlathak's Temple, Temple Halls",'Glacial Trail, Drifter Cavern',"Ancient's Way, Icy Cellar",'Worldstone Keep, Throne of Destruction, Worldstone Chamber'];
const nameToId=new Map(idToName.map((n,i)=>[n,i]));

// Helpers
function uniformBoundedU32(nextU32, bound){ const B=0x1_0000_0000n; const boundN=BigInt(bound>>>0); const threshold=(B-boundN)%boundN; while(true){ const r=nextU32(); const rN=BigInt(r>>>0); if(rN>=threshold) return Number(rN%boundN)>>>0; } }
function uniformAltLimit(nextU32, bound){ const limit = Math.floor(4294967296 / bound) * bound; while(true){ const r=nextU32()>>>0; if(r<limit) return r % bound; } }
function splitmix64_step(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n & 0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn & 0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z; }

// PCG32 core, multiple outputs
const PCG_MULS=[6364136223846793005n, 15750249268501108917n, 12605985483714917081n];
function pcg32_step(st){ st.state = (st.state * st.mul + st.inc) & 0xFFFF_FFFF_FFFF_FFFFn; }
function pcg32_seed(initstate, initseq, mul){ const st={state:0n,inc:((initseq<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn,mul}; pcg32_step(st); st.state=(st.state + (initstate&0xFFFF_FFFF_FFFF_FFFFn)) & 0xFFFF_FFFF_FFFF_FFFFn; pcg32_step(st); return st; }
function rotr32(x,r){ r&=31; return ((x>>>r)|(x<<((32-r)&31)))>>>0; }
function o_xsh_rr(st, s=18n, rsh=27n, rotShift=59n){ const old=st.state; pcg32_step(st); const xorshifted=Number(((old>>s)^old)>>rsh)>>>0; const rot=Number(old>>rotShift)&31; return rotr32(xorshifted, rot); }
function o_xsl_rr(st, s=5n, rsh=27n, rotShift=58n){ const old=st.state; pcg32_step(st); const xorshifted=Number(((old>>s)^old)>>rsh)>>>0; const rot=Number(old>>rotShift)&31; return rotr32(xorshifted, rot); }
function o_rxs_m_xs(st, shr1=22n, mulC=0x85ebca6b, shr2=13, rotShift=61n){ const old=st.state; pcg32_step(st); let x=Number(((old>>shr1)^old)&0xFFFF_FFFFn)>>>0; x=Math.imul(x, mulC)>>>0; x^=x>>>shr2; const rot=Number(old>>rotShift)&31; return rotr32(x, rot); }
function o_dxsm(st){ const old=st.state; pcg32_step(st); let x=Number(((old>>32n)^old)&0xFFFF_FFFFn)>>>0; x=Math.imul(x, 0xc2b2ae35)>>>0; x^=x>>>16; return x>>>0; }

// PCG64 64->fold32 variants
function pcg64_seed(initstate, initseq, mul){ const st={state:0n,inc:((initseq<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn,mul}; st.state=(st.state*mul + st.inc)&0xFFFF_FFFF_FFFF_FFFFn; st.state=(st.state + (initstate&0xFFFF_FFFF_FFFF_FFFFn))&0xFFFF_FFFF_FFFF_FFFFn; st.state=(st.state*mul + st.inc)&0xFFFF_FFFF_FFFF_FFFFn; return st; }
function pcg64_step(st){ st.state=(st.state*st.mul + st.inc)&0xFFFF_FFFF_FFFF_FFFFn; }
function fold32_murmur(x){ x = (x ^ (x>>32n)) & 0xFFFF_FFFF_FFFF_FFFFn; x = (x*0x9E3779B97F4A7C15n) & 0xFFFF_FFFF_FFFF_FFFFn; x ^= x>>29n; return Number(x>>32n)>>>0; }
function pcg64_out_rxsmxs(st, shr1, mulC, shr2, rotShift){ const old=st.state; pcg64_step(st); let x=(old ^ (old>>shr1)) & 0xFFFF_FFFF_FFFF_FFFFn; x=(x * BigInt(mulC)) & 0xFFFF_FFFF_FFFF_FFFFn; x^= x>>BigInt(shr2); const rot=Number(old>>rotShift)&31; const x32=Number(x & 0xFFFF_FFFFn)>>>0; return rotr32(x32, rot); }

// Per-hour selection with retry and multi-draw models
function simulatePrefix(nextU32, names, cfg){
  let matched=0; let last=-1; const N=names.length;
  for(let i=0;i<cfg.globalWarmup;i++) nextU32();
  for(let h=0; h<N; h++){
    for(let k=0;k<cfg.preDraws;k++) nextU32();
    let chosen=-1; let nonRepeatSeen=0; let attempts=0;
    if(cfg.pickKNonRepeat>=0){
      // Multi-draw-per-hour: pick K-th non-repeat among D draws
      for(let d=0; d<cfg.drawsPerHour; d++){
        const r = cfg.selMethod===0? (nextU32()%ZONE_COUNT) : (cfg.selMethod===1? uniformBoundedU32(nextU32, ZONE_COUNT) : uniformAltLimit(nextU32, ZONE_COUNT));
        const id=r>>>0;
        if(id!==last){ if(nonRepeatSeen===cfg.pickKNonRepeat){ chosen=id; break; } nonRepeatSeen++; }
      }
    }
    if(chosen===-1){
      // Retry-until-nonrepeat with optional retryLimit
      while(true){
        const r = cfg.selMethod===0? (nextU32()%ZONE_COUNT) : (cfg.selMethod===1? uniformBoundedU32(nextU32, ZONE_COUNT) : uniformAltLimit(nextU32, ZONE_COUNT));
        const id=r>>>0;
        attempts++;
        if(id!==last){ chosen=id; break; }
        if(cfg.retryLimit>0 && attempts>=cfg.retryLimit){ chosen=id; break; }
      }
    }
    const expectedId=nameToId.get(names[h]);
    if(chosen!==expectedId) return matched;
    matched++; last=chosen;
    for(let k=0;k<cfg.postDraws;k++) nextU32();
  }
  return matched;
}

function* pcg32Factories(){
  const incs=[1442695040888963407n, ((SEED<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn, (splitmix64_step(SEED)|1n)&0xFFFF_FFFF_FFFF_FFFFn];
  const xshParams=[[18n,27n,59n],[22n,27n,59n],[18n,26n,59n]];
  const xslParams=[[5n,27n,58n],[7n,27n,59n]];
  const rxParams=[[22n,0x85ebca6b,13,61n],[27n,0xc2b2ae35,16,61n],[18n,0x9e3779b1,17,61n]];
  for(const mul of PCG_MULS){
    for(const inc of incs){
      for(const [s,rsh,rot] of xshParams) yield {label:`pcg32-xsh-rr m=${mul} i=${inc} s=${s}/${rsh}/${rot}`, make:()=>{ const st=pcg32_seed(SEED,inc,mul); return ()=>o_xsh_rr(st,s,rsh,rot); }};
      for(const [s,rsh,rot] of xslParams) yield {label:`pcg32-xsl-rr m=${mul} i=${inc} s=${s}/${rsh}/${rot}`, make:()=>{ const st=pcg32_seed(SEED,inc,mul); return ()=>o_xsl_rr(st,s,rsh,rot); }};
      for(const [s,mk,sh2,rot] of rxParams) yield {label:`pcg32-rxsmxs m=${mul} i=${inc} s=${s} mk=0x${mk.toString(16)} sh2=${sh2} rot=${rot}`, make:()=>{ const st=pcg32_seed(SEED,inc,mul); return ()=>o_rxs_m_xs(st,s,mk,sh2,rot); }};
      yield {label:`pcg32-dxsm m=${mul} i=${inc}`, make:()=>{ const st=pcg32_seed(SEED,inc,mul); return ()=>o_dxsm(st); }};
    }
  }
}

function* pcg64Factories(){
  const muls=[6364136223846793005n, 15750249268501108917n, 12605985483714917081n];
  const seqs=[SEED & 0xFFFF_FFFF_FFFF_FFFFn, splitmix64_step(SEED)&0xFFFF_FFFF_FFFF_FFFFn, (SEED^(SEED>>1n))&0xFFFF_FFFF_FFFF_FFFFn];
  const rxParams=[[22n,0x5851f42d4c957f2dn,27,59n],[27n,0xda942042e4dd58b5n,13,59n],[18n,0x94d049bb133111ebn,19,59n]];
  for(const mul of muls){
    for(const seq of seqs){
      for(const [s1,mk,s2,rs] of rxParams){
        yield {label:`pcg64-rxsmxs m=${mul} seq=${seq} s=${s1}/${s2} mk=0x${mk.toString(16)}`, make:()=>{ const st=pcg64_seed(SEED,seq,mul); return ()=>pcg64_out_rxsmxs(st,s1,mk,s2,rs); }};
      }
      yield {label:`pcg64-fold m=${mul} seq=${seq} murmur-fold`, make:()=>{ const st=pcg64_seed(SEED,seq,mul); return ()=>{ const old=st.state; pcg64_step(st); return fold32_murmur(old); }; }};
    }
  }
}

function run(){
  const {names} = parseCsv();
  const selMethods=[0,1,2]; // 0=mod,1=unbiased-threshold,2=alt-limit
  const configs=[];
  for(const selMethod of selMethods){
    for(const globalWarmup of [0,1,2,4,8,16]){
      for(const preDraws of [0,1,2,4]){
        for(const postDraws of [0,1,2,4]){
          for(const drawsPerHour of [1,2,3,4,6]){
            for(const pickKNonRepeat of [-1,0,1,2]){
              for(const retryLimit of [0,1,2,3,5]){
                configs.push({selMethod,globalWarmup,preDraws,postDraws,drawsPerHour,pickKNonRepeat,retryLimit});
              }
            }
          }
        }
      }
    }
  }
  const families=[...pcg32Factories(), ...pcg64Factories()];
  let best={prefix:0};
  for(const fam of families){
    for(const cfg of configs){
      const nextU32=fam.make();
      const prefix=simulatePrefix(nextU32, names, cfg);
      if(prefix>best.prefix){ best={prefix, label:fam.label, cfg}; if(prefix===names.length){ console.log(JSON.stringify({success:true,best},null,2)); return; } }
    }
  }
  console.log(JSON.stringify({success:false,best},null,2));
}

run();
