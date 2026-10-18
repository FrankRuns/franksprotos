// Portable validation and deterministic economics for company research output.
// Every numeric estimate has explicit provenance; unknown costs remain null.
export const assumptions = ['annualUnits','domesticShare','manufacturingCostPerUnit','importLandedCostPerUnit','handlingCostPerUnit','unitsPerTruck','milesPerLoad','freightRatePerMile','fixedCostPerLoad'];
export function validateResearch(model) {
  const errors=[];
  if(!model || typeof model!=='object') return {valid:false,errors:['Expected object']};
  if(!model.company || typeof model.company.name!=='string' || !model.company.website) errors.push('company.name and company.website required');
  if(!model.baseUnit || !model.baseUnit.name || !model.baseUnit.description) errors.push('Explicit physical base unit required');
  for(const key of assumptions){
    const a=model.assumptions?.[key];
    if(!a || typeof a!=='object'){errors.push('Missing assumption: '+key);continue}
    if(a.value!==null && (!Number.isFinite(a.value) || a.value<0))errors.push('Invalid value: '+key);
    if(!['observed','estimated','unknown','user'].includes(a.status))errors.push('Invalid status: '+key);
    if(!['high','medium','low','none'].includes(a.confidence))errors.push('Invalid confidence: '+key);
    if(!Array.isArray(a.sources))errors.push('Sources must be an array: '+key);
    if(a.status==='observed' && (!a.sources || a.sources.length===0))errors.push('Observed value requires source: '+key);
    if(a.status==='unknown' && a.value!==null)errors.push('Unknown must have null value: '+key);
  }
  const share=model.assumptions?.domesticShare?.value;
  if(share!==null && share!==undefined && share>1)errors.push('domesticShare must be 0..1');
  return {valid:errors.length===0,errors};
}
export function calculateEconomics(model){
  const check=validateResearch(model);
  if(!check.valid)throw new Error(check.errors.join('; '));
  const v=k=>model.assumptions[k].value;
  const units=v('annualUnits'),share=v('domesticShare');
  const domestic=units===null||share===null?null:units*share;
  const imports=domestic===null?null:units-domestic;
  const production=domestic===null||v('manufacturingCostPerUnit')===null?null:domestic*v('manufacturingCostPerUnit');
  const importLanded=imports===null||v('importLandedCostPerUnit')===null?null:imports*v('importLandedCostPerUnit');
  const warehouse=units===null||v('handlingCostPerUnit')===null?null:units*v('handlingCostPerUnit');
  const loads=units===null||!v('unitsPerTruck')?null:Math.ceil(units/v('unitsPerTruck'));
  const freight=loads===null||v('milesPerLoad')===null||v('freightRatePerMile')===null||v('fixedCostPerLoad')===null?null:loads*(v('milesPerLoad')*v('freightRatePerMile')+v('fixedCostPerLoad'));
  const components={production,importLanded,warehouse,freight};
  const knownTotal=Object.values(components).reduce((a,b)=>a+(b??0),0);
  const missing=Object.entries(components).filter(([,v])=>v===null).map(([k])=>k);
  return {annualUnits:units,domesticUnits:domestic,importedUnits:imports,loads,components,knownTotal,complete:missing.length===0,missing};
}
export function evaluateUnitEconomics(model){
  const result=calculateEconomics(model);
  const price=model.retailPrice?.value??null;
  const wholesale=model.wholesalePrice?.value??null;
  const unitCost=result.annualUnits>0?result.knownTotal/result.annualUnits:null;
  const warnings=[];
  if(result.missing.length)warnings.push('Incomplete cost coverage: '+result.missing.join(', '));
  if(price!==null && wholesale===null)warnings.push('Retail price is not manufacturer revenue. Do not infer margin from retail price.');
  if(wholesale!==null && unitCost!==null && result.complete && unitCost>wholesale)warnings.push('Modeled unit cost exceeds estimated wholesale revenue; investigate assumptions.');
  if(model.baseUnit?.name && /case|pallet/i.test(model.baseUnit.name))warnings.push('Verify retail and cost units are converted consistently.');
  return {...result,unitCost,retailPrice:price,wholesalePrice:wholesale,warnings};
}
