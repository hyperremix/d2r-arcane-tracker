import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED = 16664395743969097666n;
const ZONE_COUNT = 36;

function parseCSVLine(line){ const fields=[]; let curr=''; let inQ=false; for(let i=0;i<line.length;i++){ const ch=line[i]; if(inQ){ if(ch==='"'){ if(i+1<line.length && line[i+1]==='"'){ curr+='"'; i++; } else { inQ=false; } } else { curr+=ch; } } else { if(ch==='"'){ inQ=true; } else if(ch===','){ fields.push(curr); curr=''; } else { curr+=ch; } } } fields.push(curr); return fields; }
function parseCsvNames(){ const raw=readFileSync(CSV,'utf8'); const lines=raw.trim().split(/\r?\n/); const header=parseCSVLine(lines[0]); const nameIdx=header.findIndex(h=>/zone/i.test(h)); const rows=lines.slice(1).map(parseCSVLine).filter(r=>r.length>nameIdx); const names=rows.map(r=>r[nameIdx]); return names; }
const idToName=[ 'Burial Grounds, Crypt, Mausoleum','Cathedral, Catacombs','Cold Plains, Cave','Dark Wood, Underground Passage','Blood Moor, Den of Evil','Barracks, Jail','The Secret Cow Level','Stony Field','Black Marsh, The Hole','Forgotten Tower','Pit','Tristram','Lut Gholein Sewers','Rocky Waste, Stony Tomb','Dry Hills, Halls of the Dead','Far Oasis','Lost City, Valley of Snakes, Claw Viper Temple','Ancient Tunnels',"Tal Rasha's Tombs, Tal Rasha's Chamber",'Arcane Sanctuary','Spider Forest, Spider Cavern','Great Marsh','Flayer Jungle, Flayer Dungeon','Kurast Bazaar, Ruined Temple, Disused Fane','Travincal','Durance of Hate','Outer Steppes, Plains of Despair','City of the Damned, River of Flame','Chaos Sanctuary','Bloody Foothills, Frigid Highlands, Abaddon','Arreat Plateau, Pit of Acheron','Crystalline Passage, Frozen River',"Nihlathak's Temple, Temple Halls",'Glacial Trail, Drifter Cavern',"Ancient's Way, Icy Cellar",'Worldstone Keep, Throne of Destruction, Worldstone Chamber'];
const nameToId=new Map(idToName.map((n,i)=>[n,i]));

function uniformBoundedU32(nextU32, bound){ const B=0x1_0000_0000n; const boundN=BigInt(bound>>>0); const threshold=(B-boundN)%boundN; while(true){ const r=nextU32(); const rN=BigInt(r>>>0); if(rN>=threshold) return Number(rN%boundN)>>>0; } }

// splitmix64 (for seeding)
function splitmix64_step(x){ x=(x+0x9E3779B97F4A7C15n)&0xFFFF_FFFF_FFFF_FFFFn; let z=x; z=(z^(z>>30n))*0xBF58476D1CE4E5B9n & 0xFFFF_FFFF_FFFF_FFFFn; z=(z^(z>>27n))*0x94D049BB133111EBn & 0xFFFF_FFFF_FFFF_FFFFn; z^=z>>31n; return z; }

// xoroshiro128+ / ++ / **
function rotl64(x,k){ return ((x<<BigInt(k))|(x>>(64n-BigInt(k)))) & 0xFFFF_FFFF_FFFF_FFFFn; }
class Xoroshiro128Base{ constructor(seed){ let x=seed; this.s0=splitmix64_step(x); x=(x+1n)&0xFFFF_FFFF_FFFF_FFFFn; this.s1=splitmix64_step(x);} nextState(){ const s0=this.s0, s1=this.s1; const t=s0^s1; this.s0=rotl64(s0,55)^t^(t<<14n); this.s1=rotl64(t,36); } }
class Xoroshiro128Plus extends Xoroshiro128Base{ nextU32(){ const res=(this.s0 + this.s1) & 0xFFFF_FFFF_FFFF_FFFFn; this.nextState(); return Number(res>>32n)>>>0; } }
class Xoroshiro128PlusPlus extends Xoroshiro128Base{ nextU32(){ const res=rotl64((this.s0*5n)&0xFFFF_FFFF_FFFF_FFFFn,7)+this.s0 & 0xFFFF_FFFF_FFFF_FFFFn; this.nextState(); return Number(res>>32n)>>>0; } }
class Xoroshiro128StarStar { constructor(seed){ let x=seed; this.s0=splitmix64_step(x); x=(x+1n)&0xFFFF_FFFF_FFFF_FFFFn; this.s1=splitmix64_step(x);} nextU32(){ const res=(rotl64((this.s0*5n)&0xFFFF_FFFF_FFFF_FFFFn,7)*9n)&0xFFFF_FFFF_FFFF_FFFFn; const s1=this.s1^this.s0; this.s0=rotl64(this.s0,24)^s1^(s1<<16n); this.s1=rotl64(s1,37); return Number(res>>32n)>>>0; } }

// MT19937-64 (extract high 32)
class MT64{ constructor(seed){ this.mt=new BigUint64Array(312); this.index=312; this.seed(seed); }
  seed(seed){ this.mt[0]=seed&0xFFFF_FFFF_FFFF_FFFFn; for(let i=1;i<312;i++){ const x=this.mt[i-1] ^ (this.mt[i-1]>>62n); this.mt[i]= (BigInt(6364136223846793005n) * x + BigInt(i)) & 0xFFFF_FFFF_FFFF_FFFFn; } this.index=312; }
  twist(){ const N=312,M=156,MAT_A=0xB5026F5AA96619E9n, UM=0xFFFFFFFF80000000n, LM=0x7FFFFFFFn; for(let i=0;i<N;i++){ const x=(this.mt[i]&UM)|(this.mt[(i+1)%N]&LM); let xA=x>>1n; if((x&1n)!==0n) xA^=MAT_A; this.mt[i]= this.mt[(i+M)%N] ^ xA; } this.index=0; }
  next64(){ if(this.index>=312) this.twist(); let x=this.mt[this.index++]; x ^= (x>>29n) & 0x5555555555555555n; x ^= (x<<17n) & 0x71D67FFFEDA60000n; x ^= (x<<37n) & 0xFFF7EEE000000000n; x ^= (x>>43n); return x & 0xFFFF_FFFF_FFFF_FFFFn; }
  nextU32(){ const x=this.next64(); return Number(x>>32n)>>>0; }
}

function simulatePrefixWithJump(nextU32, names, cfg){
  // jump-ahead assumption: per hour, draw drawsPerHour times; pick selectionIndex-th non-repeat attempt
  let matched=0; let last=-1;
  // global warmth
  for(let i=0;i<cfg.preWarmup;i++) nextU32();
  // alignment
  for(let a=0;a<cfg.alignOffset;a++) nextU32();
  for(let h=0; h<names.length; h++){
    let sel=-1; let seen=0;
    for(let d=0; d<cfg.drawsPerHour; d++){
      const r= cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0;
      if(id!==last){ if(seen===cfg.selectionIndex){ sel=id; } seen++; if(sel!==-1) break; }
    }
    if(sel===-1){ // fallback: keep drawing until we get a non-repeat
      while(true){ const r= cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(id!==last){ sel=id; break; } }
    }
    const expected=nameToId.get(names[h]);
    if(sel!==expected) return matched;
    matched++; last=sel;
  }
  return matched;
}

function* rngFactories(){
  yield {label:'xoroshiro128+', make: (seed)=>{ const r=new Xoroshiro128Plus(seed); return ()=>r.nextU32(); }};
  yield {label:'xoroshiro128++', make: (seed)=>{ const r=new Xoroshiro128PlusPlus(seed); return ()=>r.nextU32(); }};
  yield {label:'xoroshiro128**', make: (seed)=>{ const r=new Xoroshiro128StarStar(seed); return ()=>r.nextU32(); }};
  yield {label:'mt19937-64', make: (seed)=>{ const r=new MT64(seed); return ()=>r.nextU32(); }};
}

function run(){
  const names=parseCsvNames();
  const seeds=[SEED, (SEED<<1n)&0xFFFF_FFFF_FFFF_FFFFn, SEED^(SEED>>1n), splitmix64_step(SEED), splitmix64_step(SEED+1n)];
  const preWarmups=[0,1,2,4,8,16,32,64,128,256];
  const drawsPerHour=[1,2,3,4,5,6,8,12,16,24];
  const selectionIndex=[0,1,2,3,4];
  const alignOffsets=[0,1,2,4,8,16,32,64,128,256,512,1024];
  const useBoundedOpts=[false,true];
  let best={prefix:0};
  for(const seed of seeds){
    for(const pre of preWarmups){
      for(const dph of drawsPerHour){
        for(const sel of selectionIndex){ if(sel>=dph) continue; 
          for(const align of alignOffsets){
            for(const useBounded of useBoundedOpts){
              for(const rng of rngFactories()){
                const nextU32=rng.make(seed);
                const prefix=simulatePrefixWithJump(nextU32, names, {preWarmup:pre, drawsPerHour:dph, selectionIndex:sel, alignOffset:align, useBounded});
                if(prefix>best.prefix){ best={prefix, rng:rng.label, seed:seed.toString(), preWarmup:pre, drawsPerHour:dph, selectionIndex:sel, alignOffset:align, useBounded}; if(prefix===names.length){ console.log(JSON.stringify({success:true,best},null,2)); return; } }
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
