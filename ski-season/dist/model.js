export const defaults={start:'2026-12-05',end:'2027-04-18',traffic:20,friday:17,arrival:23,returnTime:20,threshold:2,commute:60,fuel:3.5,mpg:25,travelers:3,food:25,rooms:1,tax:12,holiday:30,drivePenalty:.08,risk:.3,misc:0,magicWeekend:'auto',conditionMode:'snowpack',depthTarget:24,snowpackWeight:40,terrainWeight:40,minTerrainReports:3,minCondition:70};
export const passCapacity=m=>Math.max(0,Math.min(m.passType==='Indy'?2:100,Math.floor(Number(m.limit)||0)));
export const seasonCapacity=m=>Math.min(2,passCapacity(m));
export function weekends(s){let out=[];let d=new Date(s.start+'T12:00:00Z');while(d.getUTCDay()!==6)d.setUTCDate(d.getUTCDate()+1);while(d.toISOString().slice(0,10)<=s.end){out.push(d.toISOString().slice(0,10));d.setUTCDate(d.getUTCDate()+7)}return out;}
export function holiday(date){return (date>='2026-12-19'&&date<='2027-01-03')||(date>='2027-01-16'&&date<='2027-01-18')||(date>='2027-02-13'&&date<='2027-02-21');}
export function weatherFor(data,m,date,s=defaults){
 const d=new Date(date+'T12:00:00Z'),month=String(d.getUTCMonth()+1).padStart(2,'0'),key=`${month}-${Math.floor((d.getUTCDate()-1)/7)}`,wx=data.weather[m.id]?.[key];if(!wx)return;
 const record=data.snowHistory?.[m.id],depth=record?.baseDepthIn?.[month],coverage=depth==null?null:Math.min(depth/(s.depthTarget??24),1),surface=wx.surfaceScore??wx.score,terrainRecord=data.terrainHistory?.[m.id],terrain=terrainRecord?.terrain?.[month],terrainUsed=terrain&&terrain.reports>=(s.minTerrainReports??3);
 if(s.conditionMode==='weather')return {...wx,legacyScore:wx.score,depth,coverage,source:record?.source,terrain,terrainUsed:false,terrainSource:terrainRecord?.source,scoreMode:'Legacy weather only'};
 const depthWeight=(s.snowpackWeight??40)/100,terrainWeight=(s.terrainWeight??40)/100,surfaceWeight=Math.max(0,1-depthWeight-terrainWeight),denom=(depth==null?0:depthWeight)+(terrainUsed?terrainWeight:0)+surfaceWeight;
 const score=denom>0?((depth==null?0:depthWeight*coverage)+(terrainUsed?terrainWeight*terrain.percent/100:0)+surfaceWeight*surface)/denom:surface;
 return {...wx,legacyScore:wx.score,depth,coverage,source:record?.source,terrain,terrainUsed,terrainSource:terrainRecord?.source,score,bad:(denom>0?surfaceWeight/denom:1)*(wx.surfaceBad??wx.bad),scoreMode:depth==null&&!terrainUsed?'Recent-weather fallback':terrainUsed?'Base depth + observed terrain + weather':'Base depth + weather · terrain not used'};
}
export function buildModel(data,routing,s,active,glpk){
 if((s.minCondition??70)<0||(s.minCondition??70)>100)throw Error('Minimum condition score must be between 0 and 100.');
 if(s.snowpackWeight<0||s.terrainWeight<0||s.snowpackWeight+s.terrainWeight>100||s.depthTarget<=0||s.minTerrainReports<1)throw Error('Check condition weights, depth saturation and terrain report minimum.');
 const dates=weekends(s),options=[],subjectTo=[],byMountain=new Map();
 const hours=(a,b)=>routing.durations[a]?.[b]==null?Infinity:routing.durations[a][b]/3600*(1+s.traffic/100);
 const miles=(a,b)=>routing.distances[a]?.[b]==null?Infinity:routing.distances[a][b]/1609.344;
 const ms=data.mountains.filter(m=>m.enabled),open=(m,date)=>m&&date>=m.open&&date<=m.close;
 const add=(w,sat,sun,hotel,mode,satHours,sunHours,legs)=>{
  let drive=legs.reduce((v,[a,b])=>v+hours(a,b),0),distance=legs.reduce((v,[a,b])=>v+miles(a,b),0);if(!Number.isFinite(drive+distance))return;
  const components={weather:0,preference:0,crowds:0,risk:0,fatigue:s.drivePenalty*drive};
  for(const [m,date,h] of [[sat,w,satHours],[sun,nextDay(w),sunHours]])if(m){let wx=weatherFor(data,m,date,s);if(!wx||wx.score*100+1e-9<(s.minCondition??70))return;components.weather+=h*.55*wx.score;components.preference+=h*.30*m.preference;components.crowds+=h*.15*m.crowd*(holiday(date)?.85:1);components.risk+=s.risk*wx.bad*h;}
  const q=components.weather+components.preference+components.crowds-components.risk-components.fatigue;
  const days=Number(!!sat)+Number(!!sun),lodging=hotel?(s.overrides?.[w+'_'+hotel.id]??2*hotel.nightly*s.rooms*(1+s.tax/100)*(holiday(w)?1+s.holiday/100:1)):0;
  const fuel=distance/s.mpg*s.fuel,parking=(sat?.parking||0)+(sun?.parking||0),food=days*s.travelers*s.food,other=days*s.misc;
  const o={name:'x'+options.length,w,sat:sat?.id||null,sun:sun?.id||null,hotel:hotel?.id||null,mode,satHours,sunHours,drive,distance,legs,lodging,fuel,parking,food,other,cost:lodging+fuel+parking+food+other,q:Math.round(q*1000),components,days,sundayLeave:sun?s.returnTime-hours(sun.id,0)-.5:null,fridayArrival:hotel?s.friday+hours(0,hotel.id):null};
  options.push(o);for(const m of [sat,sun])if(m){if(!byMountain.has(m.id))byMountain.set(m.id,[]);let list=byMountain.get(m.id),v=list.find(v=>v.name===o.name);if(v)v.coef++;else list.push({name:o.name,coef:1});}
 };
 for(const w of dates){if(active[w]===false)continue;const n=nextDay(w),sats=ms.filter(m=>open(m,w)),suns=ms.filter(m=>open(m,n));const begin=options.length;
  const localSat=sats.filter(m=>hours(0,m.id)<=s.threshold),localSun=suns.filter(m=>hours(0,m.id)<=s.threshold);
  for(const a of [null,...localSat])for(const b of [null,...localSun])if(a||b){const sh=a?7:0,uh=b?Math.max(0,Math.min(7,s.returnTime-hours(b.id,0)-.5-9)):0;if(b&&uh<2)continue;add(w,a,b,null,'Day trips',sh,uh,[...(a?[[0,a.id],[a.id,0]]:[]),...(b?[[0,b.id],[b.id,0]]:[])]);}
  for(const a of sats)for(const b of suns){
   // One lodging base for both nights; exact road legs, no straight-line proxies.
   const hotels=data.hotels.filter(h=>hours(0,h.id)+s.friday<=s.arrival&&hours(h.id,a.id)<=s.commute/60&&hours(a.id,h.id)<=s.commute/60&&hours(h.id,b.id)<=s.commute/60);
   for(const h of hotels){const uh=Math.max(0,Math.min(7,s.returnTime-hours(b.id,0)-.5-9));if(uh<2)continue;add(w,a,b,h,'Two-night trip',7,uh,[[0,h.id],[h.id,a.id],[a.id,h.id],[h.id,b.id],[b.id,0]]);}
  }
  // Staying home keeps closed or otherwise infeasible weekends feasible.
  const name='x'+options.length;options.push({name,w,sat:null,sun:null,hotel:null,mode:'Stay home',satHours:0,sunHours:0,drive:0,distance:0,lodging:0,fuel:0,parking:0,food:0,other:0,cost:0,q:0,days:0});
  subjectTo.push({name:'week_'+w,vars:options.slice(begin).map(o=>({name:o.name,coef:1})),bnds:{type:glpk.GLP_FX,lb:1,ub:1}});
 }
 for(const m of ms)if(byMountain.has(m.id)){subjectTo.push({name:'pass_'+m.id,vars:byMountain.get(m.id),bnds:{type:glpk.GLP_UP,lb:0,ub:passCapacity(m)}});subjectTo.push({name:'season_visit_cap_'+m.id,vars:byMountain.get(m.id),bnds:{type:glpk.GLP_UP,lb:0,ub:2}});}
 const magic=ms.find(m=>m.name==='Magic');
 if(!magic||passCapacity(magic)<2)throw Error('Your required Magic weekend needs Magic enabled and two remaining Indy days.');
 const magicOptions=options.filter(o=>o.sat===magic.id&&o.sun===magic.id&&o.satHours>=7&&o.sunHours>=7&&(s.magicWeekend==='auto'||!s.magicWeekend||o.w===s.magicWeekend));
 if(!magicOptions.length)throw Error('No feasible full Magic weekend. Check active dates, minimum condition score, season dates and Friday/Saturday lodging.');
 subjectTo.push({name:'required_magic_weekend',vars:magicOptions.map(o=>({name:o.name,coef:1})),bnds:{type:glpk.GLP_FX,lb:1,ub:1}});
 const lp={name:'SkiSeason',objective:{direction:glpk.GLP_MAX,name:'quality',vars:options.map(o=>({name:o.name,coef:o.q}))},subjectTo,binaries:options.map(o=>o.name)};
 return {lp,options,dates,capacities:ms.map(m=>({id:m.id,limit:seasonCapacity(m)})),magicId:magic.id};
}
export function nextDay(date){let d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
export async function optimize(model,glpk){
 if(!model.options.length)return {selected:[],quality:0,status:'Optimal',variables:0};
 const first=await glpk.solve(model.lp,{msglev:glpk.GLP_MSG_OFF,presol:true,tmlim:30,mipgap:0});
 if(first.result.status!==glpk.GLP_OPT&&first.result.status!==glpk.GLP_FEAS)throw Error('No feasible schedule found. Check settings.');
 const optimum=Math.round(first.result.z),phase2=structuredClone(model.lp);
 phase2.subjectTo.push({name:'keep_quality',vars:phase2.objective.vars,bnds:{type:glpk.GLP_LO,lb:optimum-.01,ub:0}});
 phase2.objective={direction:glpk.GLP_MIN,name:'cost',vars:model.options.map(o=>({name:o.name,coef:o.cost}))};
 const second=await glpk.solve(phase2,{msglev:glpk.GLP_MSG_OFF,presol:true,tmlim:30,mipgap:0});
 const good=[glpk.GLP_OPT,glpk.GLP_FEAS].includes(second.result.status),result=good?second:first;
 const selected=model.options.filter(o=>result.result.vars[o.name]>.5);
 for(const m of model.capacities)if(selected.reduce((n,o)=>n+Number(o.sat===m.id)+Number(o.sun===m.id),0)>m.limit)throw Error('Season visit limit validation failed. No mountain may exceed two ski days.');
 if(selected.filter(o=>o.sat===model.magicId&&o.sun===model.magicId&&o.satHours>=7&&o.sunHours>=7).length!==1)throw Error('Required Magic-weekend validation failed. Schedule was not accepted.');
 return {selected,quality:optimum/1000,status:first.result.status===glpk.GLP_OPT&&second.result.status===glpk.GLP_OPT?'Optimal':'Feasible · time limit',variables:model.options.length,lp:phase2};
}
