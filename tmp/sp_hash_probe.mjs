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

function fnv1a32(str){
  let hash=0x811c9dc5>>>0; const prime=0x01000193>>>0;
  for(let i=0;i<str.length;i++){
    hash ^= str.charCodeAt(i) & 0xFF;
    hash = Math.imul(hash, prime)>>>0;
  }
  return hash>>>0;
}

function murmur3_32(key, seed=0){
  let h=seed>>>0; const c1=0xcc9e2d51>>>0, c2=0x1b873593>>>0;
  const bytes=new TextEncoder().encode(key); const nblocks=Math.floor(bytes.length/4);
  const dv=new DataView(bytes.buffer);
  for(let b=0;b<nblocks;b++){
    let k=dv.getUint32(b*4,true);
    k=Math.imul(k,c1)>>>0; k=(k<<15)|(k>>>17); k=Math.imul(k,c2)>>>0;
    h^=k; h=((h<<13)|(h>>>19))>>>0; h=((Math.imul(h,5)>>>0)+0xe6546b64)>>>0;
  }
  let k1=0; const tail=bytes.length & 3; const tailIdx=nblocks*4;
  switch(tail){
    case 3: k1 ^= bytes[tailIdx+2]<<16; // fallthrough
    case 2: k1 ^= bytes[tailIdx+1]<<8; // fallthrough
    case 1: k1 ^= bytes[tailIdx]; k1=Math.imul(k1,c1)>>>0; k1=(k1<<15)|(k1>>>17); k1=Math.imul(k1,c2)>>>0; h^=k1;
  }
  h^=bytes.length; h ^= h>>>16; h = Math.imul(h,0x85ebca6b)>>>0; h ^= h>>>13; h = Math.imul(h,0xc2b2ae35)>>>0; h ^= h>>>16;
  return h>>>0;
}

function simulate(names, hashFn, windowSize){
  const recent=[]; const out=[];
  const seedStr = SEED64.toString();
  for(let h=0; h<HOURS; h++){
    let attempt=0; let chosen=-1;
    while(true){
      const s = `${seedStr}:${h}:${attempt}`;
      const r = hashFn(s)>>>0;
      const id = (r % ZONE_COUNT)>>>0;
      if(!recent.includes(id)) { chosen=id; break; }
      attempt++;
      if(attempt>50) break; // safety
    }
    out.push(chosen);
    recent.push(chosen); if(recent.length>windowSize) recent.shift();
  }
  let match=0; for(let i=0;i<HOURS;i++){ if(out[i]===nameToId.get(names[i])) match++; }
  return match;
}

function run(){
  const names=parseCsvNames();
  let best={match:-1};
  for(const w of [2,3,4,5]){
    const m1=simulate(names, (s)=>fnv1a32(s), w);
    if(m1>best.match) best={match:m1, algo:`fnv1a32 w=${w}`};
    const m2=simulate(names, (s)=>murmur3_32(s,0), w);
    if(m2>best.match) best={match:m2, algo:`murmur3_32 seed=0 w=${w}`};
    const m3=simulate(names, (s)=>murmur3_32(s,0x9747b28c), w);
    if(m3>best.match) best={match:m3, algo:`murmur3_32 seed=0x9747b28c w=${w}`};
  }
  console.log(JSON.stringify({best},null,2));
}

run();
