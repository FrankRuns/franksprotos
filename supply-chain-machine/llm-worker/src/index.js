export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin')||'';
  const allowed=(env.ALLOWED_ORIGIN||'https://franksprotos.com').replace(/\/$/,'');
  const cors={'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'};
  if(origin&&origin!==allowed)return new Response('Origin not allowed',{status:403});
  if(request.method==='OPTIONS')return new Response(null,{headers:cors});
  if(new URL(request.url).pathname!=='/api/scenario'||request.method!=='POST')return new Response('Not found',{status:404,headers:cors});
  if(!env.OPENAI_API_KEY)return Response.json({error:'Server API key not configured'},{status:503,headers:cors});
  const raw=await request.text();if(raw.length>12000)return Response.json({error:'Request too large'},{status:413,headers:cors});
  let body;try{body=JSON.parse(raw)}catch{return Response.json({error:'Invalid JSON'},{status:400,headers:cors})}
  if(typeof body.question!=='string'||body.question.length>1200)return Response.json({error:'Invalid question'},{status:400,headers:cors});
  const instructions='You are a supply-chain scenario interpreter. Respond ONLY with a JSON object. Allowed action values: add_warehouse, add_plant, change_warehouse_fixed, explain, unsupported. For add_warehouse include city and state if known; for add_plant include city and state if known. For change_warehouse_fixed include monthly_fixed_cost as a nonnegative number. Always include explanation as one short sentence and assumptions as an array of short strings. Never claim to have run optimization or calculated costs. Do not invent company-specific facts. If user is asking about an existing scenario and not proposing a change use explain. No markdown.';
  const upstream=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{'Authorization':'Bearer '+env.OPENAI_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-4.1-mini',instructions,input:JSON.stringify({question:body.question,model:body.model||{}}),text:{format:{type:'json_object'}},max_output_tokens:450})});
  if(!upstream.ok)return Response.json({error:'LLM request failed',status:upstream.status},{status:502,headers:cors});
  const data=await upstream.json();
  const output=(data.output||[]).flatMap(x=>x.content||[]).filter(x=>x.type==='output_text').map(x=>x.text).join('');
  let action;try{action=JSON.parse(output)}catch{return Response.json({error:'Could not parse model response'},{status:502,headers:cors})}
  const allowedActions=['add_warehouse','add_plant','change_warehouse_fixed','explain','unsupported'];
  if(!allowedActions.includes(action.action))return Response.json({error:'Invalid action'},{status:502,headers:cors});
  return Response.json({action:action.action,city:String(action.city||'').slice(0,80),state:String(action.state||'').slice(0,40),monthly_fixed_cost:Number.isFinite(action.monthly_fixed_cost)?Math.max(0,action.monthly_fixed_cost):null,explanation:String(action.explanation||'').slice(0,500),assumptions:Array.isArray(action.assumptions)?action.assumptions.slice(0,5).map(x=>String(x).slice(0,180)):[]},{headers:{...cors,'Cache-Control':'no-store'}});
 }
};