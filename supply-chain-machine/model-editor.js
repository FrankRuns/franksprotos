(function(){
const $=id=>document.getElementById(id);
const input=$('modelEditPrompt'),feedback=$('modelEditFeedback');
if(!input)return;
const state={enabled:false,miles:350,rate:2.75,fixed:175};
try{Object.assign(state,JSON.parse(localStorage.getItem('scm-port-settings')||'{}'))}catch(e){}
const oldRefresh=window.refreshCosts;
function render(){
const units=Number($('cost_units').value),share=Number($('cost_domesticPct').value),capacity=Math.max(1,Number($('cost_capacity').value));
const loads=Math.ceil(units*(100-share)/100/capacity)*12;
const inbound=state.enabled?loads*(state.miles*state.rate+state.fixed):0;
const branch=$('portBranch');branch.style.display=state.enabled?'block':'none';
branch.style.opacity=state.enabled?'1':'0';
$('portBranchAssumption').textContent=loads.toLocaleString()+' inbound loads/year × ('+state.miles+' miles × $'+state.rate.toFixed(2)+'/mile + $'+state.fixed.toFixed(2)+'/load)';
$('portBranchCost').textContent=inbound.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0})+'/year';
const domestic=units*share/100*Number($('cost_manufacturing').value),handling=units*Number($('cost_handling').value);
const outboundLoads=Math.ceil(units/capacity),outbound=outboundLoads*(Number($('cost_miles').value)*Number($('cost_rate').value)+Number($('cost_fixed').value));
const total=12*(domestic+handling+outbound)+inbound;
$('flowAnnual').textContent=total.toLocaleString('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0});
$('flowAnnualContext').textContent='Partial annual cost including '+(state.enabled?'modeled inbound port freight':'no inbound port freight');
}
window.refreshCosts=function(){oldRefresh();render()};
function apply(){
const q=input.value.toLowerCase().trim();let message='';
if(/port|inbound/.test(q)&&/freight|transport|warehouse|trucking/.test(q)){
if(/remove|delete|exclude|without/.test(q)){state.enabled=false;message='Removed port-to-warehouse freight.'}
else{state.enabled=true;const miles=q.match(/([\d,.]+)\s*(?:miles|mile|mi)\b/),rate=q.match(/\$([\d,.]+)\s*(?:per mile|\/mile|\/mi)/);
if(miles)state.miles=Number(miles[1].replace(/,/g,''));if(rate)state.rate=Number(rate[1].replace(/,/g,''));
message='Added port → warehouse freight: '+state.miles+' miles at $'+state.rate.toFixed(2)+'/mile.'}
}else if(/domestic|import/.test(q)&&/%/.test(q)){const m=q.match(/([\d.]+)\s*%/);if(!m)return;
let pct=Number(m[1]);if(pct<0||pct>100)return;if(/import/.test(q)&&!/domestic/.test(q))pct=100-pct;
$('cost_domesticPct').value=pct;message='Domestic share: '+pct+'%; imports: '+(100-pct)+'%.';
}else if(/manufactur|production|handling/.test(q)&&/\$/.test(q)){const m=q.match(/\$([\d.]+)/);if(!m)return;
const key=/handling/.test(q)?'handling':'manufacturing';$('cost_'+key).value=Number(m[1]);message='Changed '+key+' to $'+Number(m[1]).toFixed(2)+'/jar.';
}else{feedback.textContent='Not supported yet. Try adding/removing port freight, changing domestic share, or editing per-jar costs.';return}
window.refreshCosts();feedback.textContent=message;input.value='';
try{localStorage.setItem('scm-port-settings',JSON.stringify(state))}catch(e){}
}
$('applyModelEdit').onclick=apply;input.addEventListener('keydown',e=>{if(e.key==='Enter')apply()});
render();
})();