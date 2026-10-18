import {validateResearch,calculateEconomics,evaluateUnitEconomics} from './model-contract.mjs';
// Synthetic fixture, not a statement about Andros or Bonne Maman.
const a=(value,status='estimated',confidence='low',sources=[])=>({value,status,confidence,sources});
const example={
 company:{name:'Example Preserves Company',website:'https://example.com'},
 baseUnit:{name:'13 oz jar',description:'One finished consumer jar of preserves'},
 retailPrice:a(6.5,'estimated','medium'),
 wholesalePrice:a(null,'unknown','none'),
 assumptions:{
  annualUnits:a(12000000),domesticShare:a(.6),
  manufacturingCostPerUnit:a(.65),importLandedCostPerUnit:a(null,'unknown','none'),
  handlingCostPerUnit:a(.12),unitsPerTruck:a(24000),
  milesPerLoad:a(650),freightRatePerMile:a(2.75),fixedCostPerLoad:a(175)
 }
};
const validated=validateResearch(example);
if(!validated.valid)throw new Error(validated.errors.join('; '));
const costs=calculateEconomics(example);
if(costs.domesticUnits!==7200000||costs.importedUnits!==4800000)throw new Error('Volume split incorrect');
if(costs.components.production!==4680000||costs.components.warehouse!==1440000)throw new Error('Cost calculation incorrect');
if(costs.complete||!costs.missing.includes('importLanded'))throw new Error('Missing imports should not count as zero');
const report=evaluateUnitEconomics(example);
if(!report.warnings.some(x=>x.includes('Retail price')))throw new Error('Retail/wholesale warning missing');
console.log('PASS: unit economics contract, volumes, partial costs and warnings');
