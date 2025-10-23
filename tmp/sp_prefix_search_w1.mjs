import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED = 16664395743969097666n;
const ZONE_COUNT = 36;
let HOURS = 5281; // full length target

function parseCSVLine(line){ const fields=[]; let curr=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(inQ){ if(ch==='"'){ if(i+1<line.length && line[i+1]==='"'){ curr+='"'; i++; } else { inQ=false; } } else { curr+=ch; } } else { if(ch==='"'){ inQ=true; } else if(ch===','){ fields.push(curr); curr=''; } else { curr+=ch; } } } fields.push(curr); return fields; }
function parseCsvNames(){ const raw=readFileSync(CSV,'utf8'); const lines=raw.trim().split(/\r?\n/); const header=parseCSVLine(lines[0]); const nameIdx=header.findIndex(h=>/zone/i.test(h)); const rows=lines.slice(1).map(parseCSVLine).filter(r=>r.length>nameIdx); const names=rows.map(r=>r[nameIdx]); HOURS = names.length; return names; }
const idToName=[ 'Burial Grounds, Crypt, Mausoleum','Cathedral, Catacombs','Cold Plains, Cave','Dark Wood, Underground Passage','Blood Moor, Den of Evil','Barracks, Jail','The Secret Cow Level','Stony Field','Black Marsh, The Hole','Forgotten Tower','Pit','Tristram','Lut Gholein Sewers','Rocky Waste, Stony Tomb','Dry Hills, Halls of the Dead','Far Oasis','Lost City, Valley of Snakes, Claw Viper Temple','Ancient Tunnels',"Tal Rasha's Tombs, Tal Rasha's Chamber",'Arcane Sanctuary','Spider Forest, Spider Cavern','Great Marsh','Flayer Jungle, Flayer Dungeon','Kurast Bazaar, Ruined Temple, Disused Fane','Travincal','Durance of Hate','Outer Steppes, Plains of Despair','City of the Damned, River of Flame','Chaos Sanctuary','Bloody Foothills, Frigid Highlands, Abaddon','Arreat Plateau, Pit of Acheron','Crystalline Passage, Frozen River',"Nihlathak's Temple, Temple Halls",'Glacial Trail, Drifter Cavern',"Ancient's Way, Icy Cellar",'Worldstone Keep, Throne of Destruction, Worldstone Chamber'];
const nameToId=new Map(idToName.map((n,i)=>[n,i]));

function uniformBoundedU32(nextU32, bound){ const B=0x1_0000_0000n; const boundN=BigInt(bound>>>0); const threshold=(B-boundN)%boundN; while(true){ const r=nextU32(); const rN=BigInt(r>>>0); if(rN>=threshold) return Number(rN%boundN)>>>0; } }

// RNGs
const PCG_MUL=6364136223846793005n; function rotr32(x,r){r&=31;return ((x>>>r)|(x<<((32-r)&31)))>>>0;}
function pcg32_next(st){ const old=st.state; st.state=(old*PCG_MUL+st.inc)&0xFFFF_FFFF_FFFF_FFFFn; const xs=Number(((old>>18n)^old)>>27n)>>>0; const rot=Number(old>>59n)&31; return rotr32(xs,rot)>>>0; }
function pcg32_seed_naive(seed,inc){ return {state: seed&0xFFFF_FFFF_FFFF_FFFFn, inc: inc&0xFFFF_FFFF_FFFF_FFFFn}; }
function pcg32_seed_reco(initstate,initseq){ const st={state:0n,inc:((initseq<<1n)|1n)&0xFFFF_FFFF_FFFF_FFFFn}; pcg32_next(st); st.state=(st.state+(initstate&0xFFFF_FFFF_FFFF_FFFFn))&0xFFFF_FFFF_FFFF_FFFFn; pcg32_next(st); return st; }
function lcg64_next(st){ st.state=(st.a*st.state+st.c)&0xFFFF_FFFF_FFFF_FFFFn; return Number(st.state>>32n)>>>0; }
function splitmix64_next(st){ st.state=(st.state+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=st.state; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n&0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn&0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return Number(z>>32n)>>>0; }
function xs128p_init(seed){ function sm(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n&0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn&0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z;} return {s0:sm(SEED), s1:sm(SEED+1n)}; }
function xs128p_next(st){ let s1=st.s0; const s0=st.s1; st.s0=s0; s1^=s1<<23n; s1&=0xFFFF_FFFF_FFFF_FFFFn; st.s1=s1^s0^(s1>>17n)^(s0>>26n); const res=(st.s1+s0)&0xFFFF_FFFF_FFFF_FFFFn; return Number(res>>32n)>>>0; }
function rotl(x,k){ return ((x<<BigInt(k))|(x>>(64n-BigInt(k))))&0xFFFF_FFFF_FFFF_FFFFn; }
function xoshiro_init(seed){ function sm(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n&0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn&0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z;} return {s:[sm(SEED),sm(SEED+1n),sm(SEED+2n),sm(SEED+3n)]}; }
function xoshiro_next(st){ const s=st.s; const result=(rotl((s[1]*5n)&0xFFFF_FFFF_FFFF_FFFFn,7)*9n)&0xFFFF_FFFF_FFFF_FFFFn; const out=Number(result>>32n)>>>0; const t=(s[1]<<17n)&0xFFFF_FFFF_FFFF_FFFFn; s[2]^=s[0]; s[3]^=s[1]; s[1]^=s[2]; s[0]^=s[3]; s[2]^=t; s[3]=rotl(s[3],45); return out; }

function simulatePrefix(nextU32, cfg, names){
  const recent=[]; // window=1: only ban immediate repeat
  for(let i=0;i<cfg.preWarmup;i++) nextU32();
  let matched=0;
  // allow aligning start with an offset in the generated stream (consume offset hours)
  for(let o=0;o<cfg.alignOffset;o++){
    // generate and discard one hour selection respecting ban-one rule
    let last=-1; // for offset phase, we don't care consistency; just move state approx like runtime
    for(let k=0;k<cfg.perHourSkips;k++) nextU32();
    while(true){ const r = cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(id!==last){ last=id; break; } }
    for(let k=0;k<cfg.postHourSkips;k++) nextU32();
  }
  let last=-1;
  for(let h=0; h<names.length; h++){
    for(let k=0;k<cfg.perHourSkips;k++) nextU32();
    let chosen=-1;
    while(true){ const r = cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(id!==last){ chosen=id; break; } }
    const expectedId=nameToId.get(names[h]);
    if(chosen!==expectedId) return matched;
    matched++;
    last=chosen;
    for(let k=0;k<cfg.postHourSkips;k++) nextU32();
  }
  return matched;
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
  const names=parseCsvNames();
  const preWarmups=[0,1,2,4,8,16,32,64,128,256];
  const perHourSkips=[0,1,2,3,4,5,6,7,8];
  const postHourSkips=[0,1,2,3,4,5,6,7,8];
  const alignOffsets=[0,1,2,4,8,16,32,64,128,256,512,1024];
  let best={prefix:0,label:""};
  for(const pr of prngs()){
    for(const useBounded of [false,true]){
      for(const preWarmup of preWarmups){
        for(const perHour of perHourSkips){
          for(const postHour of postHourSkips){
            for(const alignOffset of alignOffsets){
              const nextU32=pr.next();
              const prefix=simulatePrefix(nextU32,{useBounded,preWarmup,perHourSkips:perHour,postHourSkips:postHour,alignOffset},names);
              if(prefix>best.prefix){ best={prefix,label:pr.label,cfg:{useBounded,preWarmup,perHourSkips:perHour,postHourSkips:postHour,alignOffset}}; if(prefix===names.length){ console.log(JSON.stringify({success:true,best},null,2)); return; } }
            }
          }
        }
      }
    }
  }
  console.log(JSON.stringify({success:false,best},null,2));
}

run();
