// Stateless per-hour mapping using splitmix64(SEED op hour)
const START_ISO = '2023-01-27T00:00:00Z';
const SEED = 16664395743969097666n;
const ZONE_COUNT = 36;
function hoursSinceStart(targetIso) {
  return Math.floor((new Date(targetIso) - new Date(START_ISO)) / (60 * 60 * 1000));
}
function splitmix64(x){
  x = (x + 0x9E3779B97F4A7C15n) & 0xFFFFFFFFFFFFFFFFn;
  let z = x;
  z = (z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n & 0xFFFFFFFFFFFFFFFFn;
  z = (z ^ (z >> 27n)) * 0x94D049BB133111EBn & 0xFFFFFFFFFFFFFFFFn;
  z ^= z >> 31n;
  return Number(z >> 32n) >>> 0;
}
const idToName=new Map([[1,'Burial Grounds, Crypt, Mausoleum'],[2,'Cathedral, Catacombs'],[3,'Cold Plains, Cave'],[4,'Dark Wood, Underground Passage'],[5,'Blood Moor, Den of Evil'],[6,'Barracks, Jail'],[7,'The Secret Cow Level'],[8,'Stony Field'],[9,'Black Marsh, The Hole'],[10,'Forgotten Tower'],[11,'Pit'],[12,'Tristram'],[13,'Lut Gholein Sewers'],[14,'Rocky Waste, Stony Tomb'],[15,'Dry Hills, Halls of the Dead'],[16,'Far Oasis'],[17,'Lost City, Valley of Snakes, Claw Viper Temple'],[18,'Ancient Tunnels'],[19,"Tal Rasha\'s Tombs, Tal Rasha\'s Chamber"],[20,'Arcane Sanctuary'],[21,'Spider Forest, Spider Cavern'],[22,'Great Marsh'],[23,'Flayer Jungle, Flayer Dungeon'],[24,'Kurast Bazaar, Ruined Temple, Disused Fane'],[25,'Travincal'],[26,'Durance of Hate'],[27,'Outer Steppes, Plains of Despair'],[28,'City of the Damned, River of Flame'],[29,'Chaos Sanctuary'],[30,'Bloody Foothills, Frigid Highlands, Abaddon'],[31,'Arreat Plateau, Pit of Acheron'],[32,'Crystalline Passage, Frozen River'],[33,"Nihlathak\'s Temple, Temple Halls"],[34,'Glacial Trail, Drifter Cavern'],[35,"Ancient\'s Way, Icy Cellar"],[36,'Worldstone Keep, Throne of Destruction, Worldstone Chamber']]);
const probes=[["2025-09-27T22:00:00Z","Arreat Plateau, Pit of Acheron"],["2025-09-27T23:00:00Z","Bloody Foothills, Frigid Highlands, Abaddon"],["2025-09-28T00:00:00Z","Spider Forest, Spider Cavern"],["2025-09-28T01:00:00Z","Lost City, Valley of Snakes, Claw Viper Temple"],["2025-09-28T02:00:00Z","Flayer Jungle, Flayer Dungeon"]];
function tryForm(form){
 const results=[];
 for(const [iso,exp] of probes){
  const h=hoursSinceStart(iso);
  let state;
  if(form==="add") state=(SEED+BigInt(h))&0xFFFFFFFFFFFFFFFFn;
  if(form==="xor") state=(SEED^BigInt(h))&0xFFFFFFFFFFFFFFFFn;
  if(form==="muladd") state=(SEED*6364136223846793005n+BigInt(h))&0xFFFFFFFFFFFFFFFFn;
  if(form==="addmul") state=(SEED+BigInt(h))*6364136223846793005n & 0xFFFFFFFFFFFFFFFFn;
  const r=splitmix64(state);
  const id=(r%ZONE_COUNT)+1;const name=idToName.get(id);
  results.push({iso,h,id,name,expected:exp});
 }
 return results;
}
console.log(JSON.stringify({add:tryForm('add'),xor:tryForm('xor'),muladd:tryForm('muladd'),addmul:tryForm('addmul')},null,2));
