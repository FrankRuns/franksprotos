import {tripLegs} from './dist/route-map.js';
import {weeklyConditions} from './dist/condition-chart.js';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import GLPK from 'glpk.js/node';
import {defaults,buildModel,optimize,weekends,passCapacity,seasonCapacity,weatherFor} from './dist/model.js';
const data=JSON.parse(fs.readFileSync('dist/data.json')),routing=JSON.parse(fs.readFileSync('dist/routing.json')),g=await GLPK();
assert.equal(data.mountains.length,19);
assert.equal(Object.keys(data.snowHistory).length,19);
const jay=data.mountains.find(m=>m.id===7),january=weatherFor(data,jay,'2027-01-02'),april=weatherFor(data,jay,'2027-04-10');
assert.equal(january.depth,21);assert.equal(april.depth,22);assert.equal(january.terrain.percent,97);assert.equal(april.terrain.reports,19);
assert(Math.abs(april.score-(.4*22/24+.4*.76+.2*april.surfaceScore))<1e-12);
assert.equal(weatherFor(data,jay,'2027-04-10',{...defaults,conditionMode:'weather'}).score,data.weather[7]['04-1'].score);
assert.equal(weatherFor(data,data.mountains.find(m=>m.id===13),'2027-04-10').terrainUsed,false);
const missing=structuredClone(data);delete missing.snowHistory[7];delete missing.terrainHistory[7];
assert.equal(weatherFor(missing,jay,'2027-04-10').score,data.weather[7]['04-1'].surfaceScore);
const saturated=weatherFor(data,jay,'2027-01-02',{...defaults,depthTarget:10,snowpackWeight:100,terrainWeight:0});assert.equal(saturated.score,1);
assert.throws(()=>buildModel(data,routing,{...defaults,snowpackWeight:70,terrainWeight:40},{},g),/condition weights/);
for(const m of data.mountains){assert(Object.keys(data.weather[m.id]).length>=20);assert(routing.durations[0][m.id]>0);}
const model=buildModel(data,routing,defaults,{},g),r=await optimize(model,g);
assert(!model.options.some(t=>t.sat===4||t.sun===4));
assert(buildModel(data,routing,{...defaults,minCondition:0},{},g).options.some(t=>t.sat===4));
assert.throws(()=>buildModel(data,routing,{...defaults,minCondition:100},{},g),/No feasible full Magic weekend/);
const chart=weeklyConditions(data,defaults);assert.equal(chart.length,22);assert.equal(chart[0].date,'2026-12-01');assert.equal(chart.at(-1).date,'2027-04-27');assert(chart.every(r=>r.count===19&&r.low<=r.median&&r.median<=r.high));
for(const t of r.selected)for(const [id,date] of [[t.sat,t.w],[t.sun,new Date(new Date(t.w+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10)]])if(id)assert(weatherFor(data,data.mountains.find(m=>m.id===id),date).score*100+1e-9>=70);
assert.equal(r.status,'Optimal');assert.equal(r.selected.length,weekends(defaults).length);
for(const m of data.mountains){assert(r.selected.reduce((n,t)=>n+(t.sat===m.id)+(t.sun===m.id),0)<=seasonCapacity(m));}
for(const t of r.selected){assert.equal(t.cost,t.lodging+t.fuel+t.parking+t.food+t.other);if(t.hotel){assert(t.fridayArrival<=defaults.arrival);assert(t.lodging>0);}else for(const id of [t.sat,t.sun].filter(Boolean))assert(routing.durations[0][id]/3600*1.2<=2);if(t.sun)assert(9+t.sunHours+.5+routing.durations[t.sun][0]/3600*1.2<=20+1e-8);}
assert(model.options.some(t=>t.sat&&t.sun&&t.sat!==t.sun&&t.hotel));
assert(model.options.some(t=>t.sat===12&&t.sun===12&&t.hotel===31));
for(const name of ['Mount Sunapee','Hunter','Waterville Valley']){const m=data.mountains.find(m=>m.name===name);assert(model.options.some(t=>t.sat===m.id&&t.sun===m.id&&t.hotel>=32));}
for(const name of ['Newbury','Sunapee town','Hunter town','Tannersville','Waterville Valley town','Plymouth'])assert(data.hotels.some(h=>h.name===name));
assert.equal(routing.durations.length,1+data.mountains.length+data.hotels.length);
for(const t of model.options.filter(t=>t.days)){const c=t.components;assert.equal(t.q,Math.round(1000*(c.weather+c.preference+c.crowds-c.risk-c.fatigue)));}
const disabled=Object.fromEntries(weekends(defaults).map(w=>[w,false]));assert.throws(()=>buildModel(data,routing,defaults,disabled,g),/No feasible full Magic weekend/);
const s={...defaults,end:'2026-12-06',minCondition:0},off={'2026-12-05':false};assert.throws(()=>buildModel(data,routing,s,off,g),/No feasible full Magic weekend/);
const quoted={...s,overrides:{'2026-12-05_22':123}};const changed=buildModel(data,routing,quoted,{},g);assert(changed.options.some(t=>t.hotel===22&&t.lodging===123));
assert.equal(r.selected.filter(t=>t.sat===5&&t.sun===5&&t.satHours===7&&t.sunHours===7).length,1);
const inflated=structuredClone(data);inflated.mountains.filter(m=>m.passType==='Indy').forEach(m=>m.limit=3);const hardened=await optimize(buildModel(inflated,routing,defaults,{},g),g);for(const m of inflated.mountains)assert(hardened.selected.reduce((n,t)=>n+(t.sat===m.id)+(t.sun===m.id),0)<=2);
const pinned=await optimize(buildModel(data,routing,{...defaults,magicWeekend:'2027-02-06'},{},g),g);assert(pinned.selected.some(t=>t.w==='2027-02-06'&&t.sat===5&&t.sun===5));
assert.throws(()=>buildModel(data,routing,{...defaults,magicWeekend:'2027-02-06'},{'2027-02-06':false},g),/No feasible full Magic weekend/);
for(const t of r.selected.filter(t=>t.days))assert.deepEqual(tripLegs(t).map(l=>[l.from,l.to]),t.legs);
const html=fs.readFileSync('dist/index.html','utf8');for(const k of Object.keys(defaults))assert(html.includes('id="'+k+'"'));for(const file of ['app.js','model.js','style.css','glpk-browser.js','data.json','routing.json'])assert(fs.existsSync('dist/'+file));
console.log('Passed: optimal solve, hard two-day season caps for all mountains including unrestricted Epic, required full Magic weekend, date pinning, inactive-date errors, directional map legs, travel deadlines and cost totals.');
