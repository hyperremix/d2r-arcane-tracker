// Measures how a terror zone's chance of being picked depends on how long ago it was last picked.
//
// Usage: node scripts/tz-recency-analysis.mjs <schedule.json>
// where schedule.json is a d2emu-style array of { datetime, zone: { enUS } } (https://d2emu.com/data/tz-2023-localized.json).
//
// Prints, per recency rank (0 = the zone picked last slot, K-1 = the zone not picked for longest), the pick rate
// relative to uniform (1.00 = uniform), and the log-likelihood of a few selection models.
import fs from 'node:fs';

const entries = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const seq = entries.map((e) => e.zone.enUS);
const zones = [...new Set(seq)];
const K = zones.length;
const z = seq.map((name) => zones.indexOf(name));

let order = [];
const rankHits = Array(K).fill(0);
let ranked = 0;
for (const pick of z) {
  if (order.length === K) {
    rankHits[order.indexOf(pick)]++;
    ranked++;
  }
  order = [pick, ...order.filter((x) => x !== pick)];
}
console.log(`${seq.length} slots, ${K} zones`);
console.log('pick rate by recency rank:', rankHits.map((c, r) => `${r}:${((c / ranked) * K).toFixed(2)}`).join(' '));

const last = Array(K).fill(-1);
const steps = [];
z.forEach((pick, i) => {
  if (last.every((l) => l >= 0)) steps.push({ ages: last.map((l) => i - l), pick });
  last[pick] = i;
});
const models = {
  'uniform, no repeat': (age) => (age > 1 ? 1 : 0),
  'weight = age': (age) => age,
  'weight = age - 1': (age) => age - 1,
};
for (const [name, weight] of Object.entries(models)) {
  let ll = 0;
  for (const { ages, pick } of steps) {
    const total = ages.reduce((sum, age) => sum + weight(age), 0);
    ll += Math.log(weight(ages[pick]) / total);
  }
  console.log(`log-likelihood, ${name}: ${ll.toFixed(1)}`);
}
