const $ = id => document.getElementById(id);
const endpointKey = "scg-worker-url";
$("endpoint").value = localStorage.getItem(endpointKey) || "https://supply-chain-context-graph.ticketwitness.workers.dev";
$("endpoint").addEventListener("change", () => localStorage.setItem(endpointKey, $("endpoint").value.trim()));
let current = null;


function drawGraph(graph) {
 const host=$("graph-map"),detail=$("graph-detail");host.replaceChildren();
 const all=graph.nodes||[],flowTypes=/ships_to|can_ship_to|supplies|replenishes|delivers_to|transports_to|fulfills|flows_to|distributes_to/i;
 const types=/supplier|vendor|manufacturer|port|inbound|facility_group|warehouse|distribution|fulfillment|sortation|receive|flow.center|store|customer|market|facility|plant|factory|transport/i;
 const nodes=all.filter(n=>types.test((n.type||"")+" "+(n.label||""))).slice(0,35);
 if(!nodes.length){detail.textContent="No physical supply chain entities identified. Research more sources before drawing a network.";return;}
 const ids=new Set(nodes.map(n=>n.id)),edges=(graph.edges||[]).filter(e=>ids.has(e.source)&&ids.has(e.target)&&flowTypes.test(e.type||e.relationship||""));
 const stage=n=>{const s=((n.label||"")+" "+(n.type||"")).toLowerCase();
  if(/port|import|receiv|inbound/.test(s))return 1;
  if(/supplier|vendor|manufacturer|factory|plant/.test(s))return 0;
  if(/distribution|warehouse|flow.center|dc\\b/.test(s))return 2;
  if(/sortation|fulfill|store|retail/.test(s))return 3;
  if(/customer|guest|market|region/.test(s))return 4;
  return 2;
 };
 const stages=["Suppliers & manufacturing","Imports & inbound","Distribution network","Stores & fulfillment","Customers"];
 const sources=graph.sources||[];
 function inspect(item,edge=false){
  detail.replaceChildren();
  const title=document.createElement("strong");title.textContent=edge?((all.find(n=>n.id===item.source)?.label||item.source)+" → "+(all.find(n=>n.id===item.target)?.label||item.target)):(item.label||item.id);detail.append(title);
  const p=document.createElement("p");p.textContent=(item.type||"")+" · "+(item.status||"unknown");detail.append(p);
  if(!edge){
   for(const rule of (graph.operating_context||[]).filter(x=>x.subject_id===item.id)){const el=document.createElement("p");el.textContent=(rule.kind||"Context")+": "+rule.statement+" ("+rule.status+")";detail.append(el);}
   const count=(graph.edges||[]).filter(e=>e.source===item.id||e.target===item.id).length;
   const info=document.createElement("p");info.textContent=count+" recorded relationships. Actual facility-to-facility lanes require evidence.";detail.append(info);
  }
  for(const ref of item.evidence_ids||[]){const s=sources.find(x=>x.id===ref);if(s){const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=s.title||s.url;detail.append(a,document.createElement("br"));}}
 }
 const wrapper=document.createElement("div");wrapper.className="network-flow";
 let displayed=0;
 stages.forEach((name,i)=>{
  const group=nodes.filter(n=>stage(n)===i);
  if(!group.length)return;
  if(displayed){
   const between=edges.filter(e=>stage(nodes.find(n=>n.id===e.source))<i&&stage(nodes.find(n=>n.id===e.target))>=i);
   const connector=document.createElement("div");connector.className="network-connector";
   const arrow=document.createElement("span");arrow.textContent="↓";connector.append(arrow);
   const label=document.createElement("span");label.textContent=between.length?between.length+" documented or inferred flow"+(between.length===1?"":"s"):"No documented flow between stages";
   connector.append(label);wrapper.append(connector);
  }
  displayed++;
  const section=document.createElement("section");section.className="network-stage";
  const heading=document.createElement("div");heading.className="network-stage-heading";heading.textContent=String(i+1).padStart(2,"0")+"  "+name;section.append(heading);
  const cards=document.createElement("div");cards.className="network-cards";
  for(const n of group){
   const card=document.createElement("button");card.type="button";card.className="network-card network-"+(n.status||"unknown");
   const title=document.createElement("strong");title.textContent=n.label||n.id;
   const meta=document.createElement("small");meta.textContent=(n.type||"facility").replace(/_/g," ")+" · "+(n.status||"unknown");
   card.append(title,meta);card.addEventListener("click",()=>inspect(n));cards.append(card);
  }
  section.append(cards);wrapper.append(section);
 });
 if(edges.length){
  const flows=document.createElement("section");flows.className="network-flows";
  const heading=document.createElement("h4");heading.textContent="Recorded material flows ("+edges.length+")";flows.append(heading);
  for(const e of edges){const button=document.createElement("button");button.type="button";button.className="network-flow-row network-"+(e.status||"unknown");
   const a=all.find(n=>n.id===e.source),b=all.find(n=>n.id===e.target);
   button.textContent=(a?.label||e.source)+" → "+(b?.label||e.target)+" · "+(e.status||"unknown");
   button.addEventListener("click",()=>inspect(e,true));flows.append(button);
  }wrapper.append(flows);
 }
 host.append(wrapper);
 detail.textContent="Tap any facility or recorded flow to inspect its evidence. Stage order is illustrative; only recorded flows represent model relationships.";
}


let lastResearch=null;
function renderResearch(research){
 lastResearch=research;
 $("research-review").hidden=false;
 const host=$("research-sources");host.replaceChildren();
 const planHost=$("research-plan");planHost.replaceChildren();
 for(const item of research.research_plan||[]){const d=document.createElement("details"),s=document.createElement("summary");s.textContent=item.label+" · "+(item.trigger==="source-signal"?"Source signal":"Industry hypothesis");d.append(s);const q=document.createElement("p");q.textContent=item.question;d.append(q);for(const query of item.queries||[]){const p=document.createElement("p");p.textContent="Proposed search (not yet run): "+query;d.append(p);}planHost.append(d);}
 const header=document.createElement("p");header.textContent=(research.sources||[]).length+" sources retrieved. Public-web search: "+(research.web_search_status||"not available")+". Expand each to inspect the exact text sent to Qwen.";host.append(header);
 for(const entry of research.search_log||[]){const d=document.createElement("details"),s=document.createElement("summary");s.textContent="Executed search: "+entry.query+" · "+(entry.result_count||0)+" results"+(entry.error?" · ERROR":"");d.append(s);if(entry.error){const p=document.createElement("p");p.textContent=entry.error;d.append(p);}for(const r of entry.results||[]){const a=document.createElement("a");a.href=r.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=r.title;d.append(a,document.createElement("br"));}host.append(d);}
 for(const s of research.sources||[]){
  const d=document.createElement("details"),summary=document.createElement("summary");summary.textContent=(s.title||s.url)+" · "+s.id;
  const link=document.createElement("a");link.href=s.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open original source";
  const excerpt=document.createElement("p");excerpt.textContent=s.text||"No extract returned.";
  d.append(summary,link,excerpt);host.append(d);
 }
}
function renderClaims(graph){
 const host=$("claim-review");host.replaceChildren();
 const claims=[
  ...(graph.nodes||[]).map(x=>({label:"Facility / entity: "+(x.label||x.id),...x})),
  ...(graph.edges||[]).map(x=>({label:"Flow: "+x.source+" → "+x.target+" ("+(x.type||"relationship")+")",...x})),
  ...(graph.operating_context||[]).map(x=>({label:(x.kind||"Context")+": "+x.statement,...x})),
  ...((graph.network_summary?.facility_counts)||[]).map(x=>({label:"Reported "+x.type+": "+x.count,...x}))
 ];
 for(const claim of claims){
  const d=document.createElement("details"),s=document.createElement("summary");
  s.textContent="["+String(claim.status||"model claim").toUpperCase()+"] "+claim.label;
  const refs=document.createElement("p");refs.textContent="Evidence IDs: "+((claim.evidence_ids||[]).join(", ")||"None. This claim is not sourced.");
  d.append(s,refs);
  for(const id of claim.evidence_ids||[]){const source=(graph.sources||[]).find(x=>x.id===id);if(!source)continue;
   const a=document.createElement("a");a.href=source.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=source.title||source.url;d.append(a,document.createElement("br"));
   const excerpt=lastResearch?.sources?.find(x=>x.id===id)?.text;
   if(excerpt){const p=document.createElement("p");p.textContent="Retrieved passage: "+excerpt.slice(0,1600);d.append(p);}
  }
  host.append(d);
 }
 if(!claims.length)host.textContent="No claims extracted.";
}
async function loadResearch(endpoint){
 const response=await fetch(endpoint+"/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({website:$("company").value})});
 const data=await response.json();if(!response.ok)throw Error(data.error||"Research failed");
 renderResearch(data);return data;
}
$("research").addEventListener("click",async()=>{
  const endpoint=$("endpoint").value.trim().replace(/\/$/,"");
 if(!/^https:\/\//.test(endpoint)){$("status").textContent="Set your Worker URL in Connection settings.";return;}
 $("research").disabled=true;$("status").textContent="Collecting public pages for inspection…";
 try{const data=await loadResearch(endpoint);$("status").textContent="Research audit ready: "+data.source_count+" pages. No Qwen credits used.";}
 catch(e){$("status").textContent="Research failed: "+e.message;}
 finally{$("research").disabled=false;}
});

function showGraph(graph, source) {
  drawGraph(graph);
  renderClaims(graph);
  const hypothesisHost=$("hypotheses");hypothesisHost.replaceChildren();
  for(const h of graph.hypotheses||[]){const d=document.createElement("div");d.className="edge";const title=document.createElement("strong");title.textContent="["+(h.status||"hypothetical")+"] "+(h.statement||"");const p=document.createElement("p");p.textContent=(h.rationale||"")+(h.research_question?" Research next: "+h.research_question:"");d.append(title,p);hypothesisHost.append(d);}
  if(!(graph.hypotheses||[]).length)hypothesisHost.textContent="No explicit hypotheses returned by the model.";
  current = graph;
  $("results").hidden = false;
  $("heading").textContent = graph.company || "Context graph";
  $("counts").textContent = (graph.nodes || []).length + " discovered entities · " + (graph.edges || []).length + " relationships" + (graph.network_summary?.facility_counts?.length ? " · Reported facility counts: " + graph.network_summary.facility_counts.map(x=>x.type+": "+x.count+(x.qualifier?" ("+x.qualifier+")":"")).join("; ") : " · Total network size not established");
  $("source").textContent = source;
  $("nodes").replaceChildren();
  $("edges").replaceChildren();
  $("unknowns").replaceChildren();
  for (const node of graph.nodes || []) {
    const el = document.createElement("div"); el.className = "edge";
    el.textContent = (node.label || node.id) + " · " + (node.type || "unknown") + " · " + (node.status || "unknown");
    $("nodes").append(el);
  }
  for (const edge of graph.edges || []) {
    const el = document.createElement("div"); el.className = "edge";
    el.textContent = [edge.source, edge.type || edge.relationship, edge.target].join(" → ") + " · " + (edge.status || "unknown");
    $("edges").append(el);
  }
  for (const item of graph.unknowns || []) {
    const el = document.createElement("div"); el.className = "edge";
    el.textContent = typeof item === "string" ? item : JSON.stringify(item);
    $("unknowns").append(el);
  }
  $("raw").textContent = JSON.stringify(graph, null, 2);
  $("context").replaceChildren();
  for(const item of graph.operating_context||[]){const div=document.createElement("div");div.className="edge";const node=(graph.nodes||[]).find(n=>n.id===item.subject_id);div.textContent=(node?.label||item.subject_id)+" · "+item.kind+" · "+item.statement+" · "+item.status;$("context").append(div);}
  if(!(graph.operating_context||[]).length)$("context").textContent="No documented operational rules or capabilities extracted yet.";
  if (graph.sources && graph.sources.length) {
    const heading=document.createElement("h3"); heading.textContent="Research sources"; $("unknowns").append(heading);
    for(const source of graph.sources){const link=document.createElement("a");link.href=source.url;link.target="_blank";link.rel="noopener noreferrer";link.textContent=source.id+" · "+source.title;const div=document.createElement("div");div.className="edge";div.append(link);$("unknowns").append(div);}
  }
}
$("generate").addEventListener("click", async () => {
  const endpoint = $("endpoint").value.trim().replace(/\/$/, "");
  if (!/^https:\/\//.test(endpoint)) { $("status").textContent = "Set your HTTPS Cloudflare Worker URL under Connection settings."; return; }
  $("generate").disabled = true; $("generate").textContent = "Generating…"; $("results").hidden = true; $("status").className = "";
  $("status").textContent = "Checking public research sources…";
  const started = Date.now();
  let stage = "research";
  try {
    const research = await loadResearch(endpoint);
    stage = "generation";
    $("status").textContent = "Found " + research.source_count + " sources. Asking Qwen to build the graph…";
    const response = await fetch(endpoint + "/generate", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({website:$("company").value,evidence:research.sources,search_log:research.search_log,web_search_status:research.web_search_status})});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    showGraph({...body.graph, sources: body.sources || []}, body.evidence_url || $("company").value);
    $("results").scrollIntoView({behavior:"smooth",block:"start"});
    const dropped = body.validation?.dropped_edges_missing_endpoints || 0;
    $("status").textContent = (body.mode === "curated-reference" ? "Sourced facility reference network loaded from " : "Graph generated from ") + (body.sources || []).length + " public sources." + (dropped ? " Removed " + dropped + " invalid relationships with missing entities." : "") + " Review before using.";
    $("status").className = "good";
  } catch(e) { $("status").textContent = "Failed during " + stage + " after " + Math.round((Date.now()-started)/1000) + "s: " + e.message; $("status").className = "error"; }
  finally { $("generate").disabled = false; $("generate").textContent = "Generate context graph"; }
});
$("sample").addEventListener("click", () => {
  showGraph({company:"Fictional Demo Company",nodes:[{id:"plant",label:"Plant A",type:"facility",status:"hypothetical"},{id:"dc",label:"Distribution Center B",type:"facility",status:"hypothetical"}],edges:[{source:"plant",target:"dc",type:"can_ship_to",status:"hypothetical"}],unknowns:["Actual lanes, carriers, capacity and inventory are unknown"]},"Synthetic demonstration. No real company claims.");
  $("status").textContent = "Fictional demo loaded; no model call made.";
});
$("download").addEventListener("click", () => {
  if (!current) return;
  const blob = new Blob([JSON.stringify(current,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href=url; a.download="supply-chain-context-graph.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});

const benchmarkPlaces={
 "PA-DC":[40.2732,-76.8867],"CT-STORE":[41.7658,-72.6734],"NJ-FC":[40.7357,-74.1724],
 "CT-DC":[41.7658,-72.6734],"MA-DC":[42.3601,-71.0589],
 "OH-DC":[39.9612,-82.9988],"IN-DC":[39.7684,-86.1581],
 "GA-DC":[33.749,-84.388],"TN-DC":[36.1627,-86.7816],
 "NY-FC":[40.7128,-74.006],"customer":null
};
const benchmarkDestinations={"direct-ship":[41.7658,-72.6734],"cold-chain":[42.3601,-71.0589],"carrier-contract":[41.8781,-87.6298],"capacity":[33.749,-84.388],"inventory-eligibility":[41.3083,-72.9279]};
let benchmarkMap=null;
function renderBenchmarkMap(result){
 const host=$("benchmark-map");
 if(!window.L){host.textContent="Map tiles unavailable. Decision comparison remains below.";return;}
 if(benchmarkMap){benchmarkMap.remove();benchmarkMap=null;}
 benchmarkMap=L.map(host,{scrollWheelZoom:false});
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{attribution:"&copy; OpenStreetMap contributors",maxZoom:18}).addTo(benchmarkMap);
 const bounds=[],scenario=result.scenario,location=benchmarkDestinations[scenario.id];
 if(!location){host.textContent="No geographic reference for this scenario.";return;}
 const customer=L.circleMarker(location,{radius:9,color:"#ffffff",fillColor:"#1e94c6",fillOpacity:1,weight:2}).addTo(benchmarkMap).bindPopup("Customer destination: "+scenario.demand.destination);
 bounds.push(location);
 const colors={baseline:"#fb8f88",context_graph:"#55d7b6"};
 const selected=new Set(result.runs.map(r=>r.decision.option_id));
 for(const option of scenario.options){
  const from=benchmarkPlaces[option.from];if(!from)continue;
  const run=result.runs.find(r=>r.decision.option_id===option.id);
  const color=run?colors[run.condition]:"#93a7b9";
  const offset=option.to==="CT-STORE"?benchmarkPlaces["CT-STORE"]:location;
  L.polyline([from,offset],{color,weight:run?5:2,opacity:run?0.95:0.45,dashArray:run?.grade.feasible?null:"7 7"}).addTo(benchmarkMap).bindPopup(option.id+" · $"+option.cost+" · "+option.days+" day(s)"+(run?" · "+run.condition:""));
  L.circleMarker(from,{radius:7,color:"#fff",weight:1,fillColor:color,fillOpacity:0.95}).addTo(benchmarkMap).bindPopup(option.from+" (approximate city center)");
  bounds.push(from);
 }
 if(scenario.id==="direct-ship"){
  const store=benchmarkPlaces["CT-STORE"];
  L.circleMarker(store,{radius:5,color:"#fff",fillColor:"#55d7b6",fillOpacity:1}).addTo(benchmarkMap).bindPopup("CT store: pickup destination");
 }
 benchmarkMap.fitBounds(bounds,{padding:[35,35],maxZoom:8});
 setTimeout(()=>benchmarkMap?.invalidateSize(),150);
}
function renderBenchmarkExplanation(result){
 const base=result.runs.find(r=>r.condition==="baseline"),graph=result.runs.find(r=>r.condition==="context_graph");
 const host=$("benchmark-explanation");host.replaceChildren();
 const title=document.createElement("strong");title.textContent=base.grade.feasible===graph.grade.feasible?"What did we learn?":graph.grade.feasible?"Why the graph helped":"What changed?";host.append(title);
 const p=document.createElement("p");
 if(!base.grade.feasible&&graph.grade.feasible)p.textContent="Without operational context, ChatGPT chose "+base.decision.option_id+" ($"+base.grade.cost+"), which violates a real constraint in this synthetic scenario. With the graph, it chose "+graph.decision.option_id+" ($"+graph.grade.cost+"), a feasible option. The extra cost buys a valid decision, not an improvement in shipping price.";
 else if(base.grade.feasible&&graph.grade.feasible)p.textContent="Both decisions were feasible. Compare their costs and explanations to see whether the graph improved efficiency.";
 else p.textContent="The graph did not produce a clear feasibility win in this trial. Review both choices and the operational rules below.";
 host.append(p);
 const rules=document.createElement("p");rules.textContent="Relevant rule: "+result.context_graph.operational_rules.map(r=>r.statement).join(" · ");host.append(rules);
}

$("run-benchmark").addEventListener("click",async()=>{
 const button=$("run-benchmark"),status=$("benchmark-status"),output=$("benchmark-output");
 button.disabled=true;output.hidden=true;status.textContent="Running two matched OpenAI decisions…";
 try{
 const endpoint=$("endpoint").value.trim().replace(/\/$/,"");
  if(!endpoint)throw Error("Set the Cloudflare Worker URL in Connection settings first.");
  const response=await fetch(endpoint+"/benchmark",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({scenario_id:$("benchmark-scenario").value})});
  const result=await response.json();if(!response.ok)throw Error(result.error||"Benchmark request failed");
  const cards=$("benchmark-cards");cards.replaceChildren();
  for(const run of result.runs){
   const card=document.createElement("div");card.className="benchmark-result";
   const h=document.createElement("h4");h.textContent=run.condition==="baseline"?"ChatGPT alone":"ChatGPT + context graph";card.append(h);
   const score=document.createElement("div");score.className="score "+(run.grade.feasible?"pass":"fail");score.textContent=run.grade.feasible?"Feasible":"Infeasible";card.append(score);
   for(const line of ["Selected: "+(run.decision.option_id||"none"),"Cost: "+(run.grade.cost==null?"N/A":"$"+run.grade.cost),"Optimal feasible cost: $"+run.grade.optimal_cost,"Regret: "+(run.grade.regret==null?"N/A":"$"+run.grade.regret)]){
    const p=document.createElement("p");p.textContent=line;card.append(p);
   }
   const reason=document.createElement("p");reason.textContent=run.decision.reason||"";card.append(reason);cards.append(card);
  }
  $("benchmark-raw").textContent=JSON.stringify(result,null,2);output.hidden=false;
  renderBenchmarkExplanation(result);renderBenchmarkMap(result);
  status.textContent="Paired experiment complete using "+result.model+". These results are one trial, not proof of a performance difference.";
 }catch(e){status.textContent="Benchmark failed: "+e.message;status.className="error";}
 finally{button.disabled=false;}
});
