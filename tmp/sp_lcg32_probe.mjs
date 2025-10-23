import { readFileSync } from 'fs';

const CSV = '/Users/f00486/playground/d2r-arcane-tracker/terrorzone-schedule.csv';
const SEED64 = 16664395743969097666n;
const HOURS = 938;
const ZONE_COUNT = 36;

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
  'Arreat Plateau, Pit of Acheron','Crystalline Passage, Frozen River',"Nihlathak's Temple, Temple Halls",'Glacial Trail, Drifter Cavern',"Ancient's Way, Icy Cellar",'Worldstone Keep, Throne of Destruction, Worldstone Chamber'
];
const nameToId=new Map(idToName.map((n,i)=>[n,i]));

function uniformBoundedU32(nextU32, bound){ const B=0x1_0000_0000n; const boundN=BigInt(bound>>>0); const threshold=(B-boundN)%boundN; while(true){ const r=nextU32(); const rN=BigInt(r>>>0); if(rN>=threshold) return Number(rN%boundN)>>>0; } }

// LCG32 generic
function makeLCG32(a, c, seed32){
  let state = seed32>>>0;
  return {
    next32: ()=>{ state = (((state>>>0) * (a>>>0)) + (c>>>0)) >>> 0; return state>>>0; },
    nextHigh16: ()=>{ state = (((state>>>0) * (a>>>0)) + (c>>>0)) >>> 0; return (state>>>16)>>>0; },
    nextCombined32: ()=>{ // combine two high16s
      state = (((state>>>0) * (a>>>0)) + (c>>>0)) >>> 0; const hi1 = state>>>16;
      state = (((state>>>0) * (a>>>0)) + (c>>>0)) >>> 0; const hi2 = state>>>16;
      return (((hi1 & 0xFFFF) << 16) | (hi2 & 0xFFFF)) >>> 0;
    }
  };
}

function simulatePrefix(nextU32, cfg, names){
  const recent=[];
  for(let i=0;i<cfg.preWarmup;i++) nextU32();
  let matched=0;
  for(let h=0; h<HOURS; h++){
    for(let k=0;k<cfg.perHourSkips;k++) nextU32();
    let chosen=-1;
    while(true){ const r = cfg.useBounded? uniformBoundedU32(nextU32, ZONE_COUNT) : (nextU32()%ZONE_COUNT); const id=r>>>0; if(!recent.includes(id)){ chosen=id; break; } }
    const expectedId=nameToId.get(names[h]);
    if(chosen!==expectedId) return matched;
    matched++;
    recent.push(chosen); if(recent.length>cfg.windowSize) recent.shift();
    for(let k=0;k<cfg.postHourSkips;k++) nextU32();
  }
  return matched;
}

function run(){
  const names=parseCsvNames();
  const seed32s=[ Number(SEED64 & 0xFFFFFFFFn)>>>0, Number((SEED64>>32n)&0xFFFFFFFFn)>>>0, Number((SEED64^(SEED64>>32n)) & 0xFFFFFFFFn)>>>0, 0x12345678>>>0, 0xDEADBEEF>>>0 ];
  const lcgParams=[
    {label:'msvcrt', a:214013>>>0, c:2531011>>>0},
    {label:'ansi-c', a:1103515245>>>0, c:12345>>>0},
    {label:'borland', a:22695477>>>0, c:1>>>0},
    {label:'minstd0', a:16807>>>0, c:0>>>0},
  ];
  const outputs=['next32','nextHigh16','nextCombined32'];
  const preWarmups=[0,1,2,4,8,16,32,64,128,256,512,1024];
  const perHourSkips=[0,1,2,3,4,5,6,7,8];
  const postHourSkips=[0,1,2,3,4,5,6,7,8];
  const windowSizes=[2,3,4];

  let best={prefix:0};
  for(const p of lcgParams){
    for(const s of seed32s){
      for(const out of outputs){
        for(const useBounded of [false,true]){
          for(const windowSize of windowSizes){
            for(const preWarmup of preWarmups){
              for(const perHour of perHourSkips){
                for(const postHour of postHourSkips){
                  const lcg = makeLCG32(p.a, p.c, s);
                  const gen = out==='next32'? lcg.next32 : out==='nextHigh16'? lcg.nextHigh16 : lcg.nextCombined32;
                  const nextU32=()=>gen();
                  const prefix=simulatePrefix(nextU32,{useBounded,windowSize,preWarmup,perHourSkips:perHour,postHourSkips:postHour},names);
                  if(prefix>best.prefix){ best={prefix, label:`${p.label} seed=0x${s.toString(16)} out=${out}`, cfg:{useBounded,windowSize,preWarmup,perHourSkips:perHour,postHourSkips:postHour} }; if(prefix===HOURS){ console.log(JSON.stringify({success:true,best},null,2)); return; } }
                }
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
