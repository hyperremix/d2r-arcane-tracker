import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED64 = 16664395743969097666n;
const ZONE_COUNT = 36;
const HOURS = 938;

function parseCsvNames(){
  const lines=readFileSync(CSV,'utf8').trim().split(/\r?\n/).slice(1);
  return lines.map(l=>l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/)[3].replace(/^"|"$/g,'')).slice(0,HOURS);
}
const idToName=[
  'Burial Grounds, Crypt, Mausoleum','Cathedral, Catacombs','Cold Plains, Cave','Dark Wood, Underground Passage',
  'Blood Moor, Den of Evil','Barracks, Jail','The Secret Cow Level','Stony Field','Black Marsh, The Hole','Forgotten Tower',
  'Pit','Tristram','Lut Gholein Sewers','Rocky Waste, Stony Tomb','Dry Hills, Halls of the Dead','Far Oasis',
  'Lost City, Valley of Snakes, Claw Viper Temple','Ancient Tunnels',"Tal Rasha's Tombs, Tal Rasha's Chamber",'Arcane Sanctuary',
  'Spider Forest, Spider Cavern','Great Marsh','Flayer Jungle, Flayer Dungeon','Kurast Bazaar, Ruined Temple, Disused Fane','Travincal',
  'Durance of Hate','Outer Steppes, Plains of Despair','City of the Damned, River of Flame','Chaos Sanctuary','Bloody Foothills, Frigid Highlands, Abaddon',
  'Arreat Plateau, Pit of Acheron','Crystalline Passage, Frozen River',"Nihlathak's Temple, Temple Halls",'Glacial Trail, Drifter Cavern',"Ancient's Way, Icy Cellar",'Worldstone Keep, Throne of Destruction, Worldstone Chamber']
const nameToId=new Map(idToName.map((n,i)=>[n,i]));

// MT19937 implementation (32-bit)
class MT {
  constructor(seed){ this.mt=new Uint32Array(624); this.index=624; this.seed(seed>>>0); }
  seed(s){ this.mt[0]=s>>>0; for(let i=1;i<624;i++){ const x=this.mt[i-1]^ (this.mt[i-1]>>>30); this.mt[i]=(((x>>>0)*1812433253) + i)>>>0; } this.index=624; }
  twist(){ for(let i=0;i<624;i++){ const y=((this.mt[i]&0x80000000) + (this.mt[(i+1)%624]&0x7fffffff))>>>0; this.mt[i]= (this.mt[(i+397)%624] ^ (y>>>1))>>>0; if(y&1) this.mt[i]^=0x9908b0df; } this.index=0; }
  next(){ if(this.index>=624) this.twist(); let y=this.mt[this.index++]; y^= y>>>11; y^= (y<<7) & 0x9d2c5680; y^= (y<<15) & 0xefc60000; y^= y>>>18; return y>>>0; }
}

function uniformBoundedU32(nextU32,bound){ const B=0x1_0000_0000n; const boundN=BigInt(bound>>>0); const threshold=(B-boundN)%boundN; while(true){ const r=nextU32(); const rN=BigInt(r>>>0); if(rN>=threshold) return Number(rN%boundN)>>>0; } }

function simulate(nextU32, cfg){
  const out=[]; const recent=[];
  for(let i=0;i<cfg.preWarmup;i++) nextU32();
  for(let h=0;h<HOURS;h++){
    for(let k=0;k<cfg.perHourSkips;k++) nextU32();
    let chosen=-1;
    while(true){
      let r = cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT);
      const id=r>>>0;
      if(!recent.includes(id)){ chosen=id; break; }
    }
    out.push(chosen);
    recent.push(chosen); if(recent.length>cfg.windowSize) recent.shift();
    for(let k=0;k<cfg.postHourSkips;k++) nextU32();
  }
  return out;
}

function score(ids, names){ let m=0; for(let i=0;i<HOURS;i++){ if(ids[i]===nameToId.get(names[i])) m++; } return m; }

function run(){
  const names=parseCsvNames();
  const seeds=[ Number(SEED64 & 0xffffffffn), Number((SEED64>>32n) & 0xffffffffn), Number((SEED64 ^ (SEED64>>32n)) & 0xffffffffn) ];
  let best={match:-1};
  for(const s of seeds){
    for(const useBounded of [false,true]){
      for(const windowSize of [2,3,4]){
        for(const preWarmup of [0,1,4,16,64,256]){
          for(const perHourSkips of [0,1,2,3,4]){
            for(const postHourSkips of [0,1,2,3,4]){
              const mt=new MT(s>>>0);
              const ids=simulate(()=>mt.next(),{useBounded, windowSize, preWarmup, perHourSkips, postHourSkips});
              const match=score(ids,names);
              if(match>best.match){ best={match, s, useBounded, windowSize, preWarmup, perHourSkips, postHourSkips}; if(match===HOURS){ console.log(JSON.stringify({success:true,best},null,2)); return; } }
            }
          }
        }
      }
    }
  }
  console.log(JSON.stringify({success:false,best},null,2));
}

run();
