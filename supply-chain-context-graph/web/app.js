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



function renderMainGeography(graph){
 const host=$("main-geo-map"),note=$("main-geo-note");if(!host)return;
 if(host._leafletMap){host._leafletMap.remove();host._leafletMap=null;}
 host.replaceChildren();
 const nodes=(graph.nodes||[]).filter(n=>{const c=n.coordinates||n.location?.coordinates||{};return Number.isFinite(Number(n.lat??n.latitude??c.lat))&&Number.isFinite(Number(n.lng??n.lon??n.longitude??c.lng??c.lon));});
 if(!nodes.length){host.textContent="No verified coordinates in this graph. Add latitude/longitude to facility nodes to see a geographic map. We won't invent locations.";note.textContent="Geographic coverage: 0 located facilities.";return;}
 if(typeof L==="undefined"){host.textContent="Map library unavailable.";return;}
 const map=L.map(host).setView([30,0],3);host._leafletMap=map;
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(map);
 const coords=n=>{const c=n.coordinates||n.location?.coordinates||{};return [Number(n.lat??n.latitude??c.lat),Number(n.lng??n.lon??n.longitude??c.lng??c.lon)];};
 const byId=new Map(nodes.map(n=>[n.id,n])),bounds=[];
 for(const n of nodes){const p=coords(n);bounds.push(p);L.circleMarker(p,{radius:7,color:n.status==="verified"?"#6edac8":"#f2c66d",fillOpacity:.85}).addTo(map).bindPopup(document.createTextNode((n.label||n.id)+" · "+(n.status||"unverified")).textContent);}
 let links=0;
 for(const e of graph.edges||[]){if(!byId.has(e.source)||!byId.has(e.target)||!/ship|flow|transport|deliver|supply|replenish|distribut/i.test(e.type||e.relationship||""))continue;L.polyline([coords(byId.get(e.source)),coords(byId.get(e.target))],{color:e.status==="verified"?"#6edac8":"#f2c66d",weight:3,dashArray:e.status==="verified"?null:"6 6"}).addTo(map);links++;}
 map.fitBounds(bounds,{padding:[30,30],maxZoom:8});setTimeout(()=>map.invalidateSize(),100);
 note.textContent=nodes.length+" located facilities · "+links+" mapped flows. Straight lines are relationships, not road routes. Unverified claims are yellow.";
}
function localGraphChecks(graph){
 const nodes=graph.nodes||[],edges=graph.edges||[],ids=new Set(nodes.map(n=>n.id));
 const problems=[];
 for(const e of edges)if(!ids.has(e.source)||!ids.has(e.target))problems.push("Broken edge: "+(e.source||"?")+" → "+(e.target||"?"));
 for(const n of nodes)if(n.status==="verified"&&!(n.evidence_ids||[]).length)problems.push("Missing evidence: "+(n.label||n.id));
 for(const e of edges)if(e.status==="verified"&&!(e.evidence_ids||[]).length)problems.push("Missing edge evidence: "+e.source+" → "+e.target);
 return {nodes:nodes.length,edges:edges.length,problems};
}
function showLocalChecks(graph){
 const el=$("local-checks");if(!el)return;const r=localGraphChecks(graph);
 el.replaceChildren();const summary=document.createElement("p");summary.textContent=r.nodes+" nodes · "+r.edges+" edges · "+r.problems.length+" validation warnings. No API calls.";el.append(summary);
 for(const issue of r.problems.slice(0,25)){const p=document.createElement("p");p.textContent="⚠ "+issue;el.append(p);}
 if(!r.problems.length){const p=document.createElement("p");p.textContent="No broken references or missing evidence on verified claims.";el.append(p);}
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
  renderMainGeography(graph);
  showLocalChecks(graph);
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

const benchmarkPreview={
 "direct-ship":{id:"direct-ship",demand:{destination:"Hartford"},options:[{id:"pa-direct",from:"PA-DC",to:"customer",cost:8,days:1},{id:"pa-store",from:"PA-DC",to:"CT-STORE",cost:14,days:2},{id:"nj-fulfillment",from:"NJ-FC",to:"customer",cost:19,days:2}]},
 "cold-chain":{id:"cold-chain",demand:{destination:"Boston"},options:[{id:"ambient",from:"CT-DC",to:"customer",cost:35,days:1},{id:"reefer",from:"CT-DC",to:"customer",cost:65,days:2},{id:"remote-reefer",from:"MA-DC",to:"customer",cost:90,days:1}]},
 "carrier-contract":{id:"carrier-contract",demand:{destination:"Chicago"},options:[{id:"spot",from:"OH-DC",to:"customer",cost:12,days:1},{id:"contract",from:"OH-DC",to:"customer",cost:20,days:2},{id:"backup",from:"IN-DC",to:"customer",cost:26,days:2}]},
 "capacity":{id:"capacity",demand:{destination:"Atlanta"},options:[{id:"fast",from:"GA-DC",to:"customer",cost:100,days:1},{id:"standard",from:"GA-DC",to:"customer",cost:130,days:2},{id:"overflow",from:"TN-DC",to:"customer",cost:155,days:2}]},
 "inventory-eligibility":{id:"inventory-eligibility",demand:{destination:"New Haven"},options:[{id:"reserved",from:"CT-DC",to:"customer",cost:18,days:1},{id:"available",from:"NY-FC",to:"customer",cost:29,days:2},{id:"slow",from:"PA-DC",to:"customer",cost:15,days:4}]}
};
function showBenchmarkPreview(){
 try{renderBenchmarkMap({scenario:benchmarkPreview[$("benchmark-scenario").value],runs:[]});}
 catch(e){$("benchmark-map").textContent="Map preview error: "+e.message;}
}
$("benchmark-scenario").addEventListener("change",showBenchmarkPreview);
showBenchmarkPreview();

function renderBenchmarkMap(result){
 const host=$("benchmark-map");host.replaceChildren();
 const scenario=result.scenario,destination=benchmarkDestinations[scenario.id];
 if(!destination){host.textContent="No geographic reference available.";return;}
 // Self-contained geographic plot: no map library, tile server or CDN required.
 // Equirectangular projection over a padded lat/lon bounding box; city-center coordinates only.
 const sites=[...scenario.options.map(o=>({id:o.from,point:benchmarkPlaces[o.from]})).filter(x=>x.point),{id:"Customer",point:destination}];
 if(scenario.id==="direct-ship")sites.push({id:"CT store pickup",point:benchmarkPlaces["CT-STORE"]});
 const lats=sites.map(s=>s.point[0]),lons=sites.map(s=>s.point[1]);
 const latMin=Math.min(...lats)-0.55,latMax=Math.max(...lats)+0.55,lonMin=Math.min(...lons)-0.8,lonMax=Math.max(...lons)+0.8;
 const width=640,height=390,pad=45;
 const xy=p=>[pad+(p[1]-lonMin)/(lonMax-lonMin)*(width-2*pad),height-pad-(p[0]-latMin)/(latMax-latMin)*(height-2*pad)];
 const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
 svg.setAttribute("viewBox","0 0 640 390");svg.setAttribute("role","img");svg.setAttribute("aria-label","Geographic positions and straight-line shipping alternatives");
 svg.style.cssText="width:100%;height:100%;display:block;background:#132b3b;border-radius:12px";
 const el=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs||{}))n.setAttribute(k,String(v));if(text!=null)n.textContent=text;svg.append(n);return n;};
 for(let i=0;i<=5;i++){
  const lat=latMin+(latMax-latMin)*i/5,y=xy([lat,lonMin])[1];
  el("line",{x1:pad,y1:y,x2:width-pad,y2:y,stroke:"#38566b","stroke-width":1});
  el("text",{x:5,y:y+4,fill:"#9db7c9","font-size":11},lat.toFixed(1)+"°N");
  const lon=lonMin+(lonMax-lonMin)*i/5,x=xy([latMin,lon])[0];
  el("line",{x1:x,y1:pad,x2:x,y2:height-pad,stroke:"#38566b","stroke-width":1});
  el("text",{x:x-17,y:height-13,fill:"#9db7c9","font-size":11},Math.abs(lon).toFixed(1)+"°W");
 }
 const choices=result.runs;
 for(const option of scenario.options){
  const from=benchmarkPlaces[option.from],to=option.to==="customer"?destination:benchmarkPlaces[option.to];
  if(!from||!to)continue;
  const chosen=choices.find(r=>r.condition==="context_graph"&&r.decision.option_id===option.id)||choices.find(r=>r.condition==="baseline"&&r.decision.option_id===option.id);
  const color=chosen?(chosen.condition==="context_graph"?"#55d7b6":"#fb8f88"):"#91a6b6";
  const [x1,y1]=xy(from),[x2,y2]=xy(to);
  const line=el("line",{x1,y1,x2,y2,stroke:color,"stroke-width":chosen?5:2,"stroke-dasharray":chosen&&!chosen.grade.feasible?"9 6":"none",opacity:chosen?1:0.55});
  const title=document.createElementNS(ns,"title");title.textContent=option.from+" → "+option.to+" | $"+option.cost+" | "+option.days+" days";line.append(title);
 }
 for(const site of sites){
  const [x,y]=xy(site.point);
  el("circle",{cx:x,cy:y,r:7,fill:site.id==="Customer"?"#fff":"#55d7b6",stroke:"#173448","stroke-width":2});
  const label=site.id==="Customer"?"Customer · "+scenario.demand.destination:site.id;
  el("text",{x:x+10,y:y-10,fill:"#f0f7fb","font-size":13,"font-weight":700,stroke:"#132b3b","stroke-width":3,"paint-order":"stroke"},label);
 }
 el("text",{x:width-14,y:20,"text-anchor":"end",fill:"#9db7c9","font-size":11},"Latitude / longitude · schematic geography");
 host.append(svg);
}
function renderFulfillmentFlow(result){
 const scenario=result.scenario,base=result.runs.find(r=>r.condition==="baseline"),graph=result.runs.find(r=>r.condition==="context_graph");
 const selected=scenario.options.find(o=>o.id===graph.decision.option_id);
 const host=$("benchmark-flow");host.replaceChildren();
 if(!selected){host.textContent="No valid fulfillment option was selected.";return;}
 const label=id=>({"PA-DC":"Pennsylvania distribution center","CT-STORE":"Connecticut store","NJ-FC":"New Jersey fulfillment center","CT-DC":"Connecticut distribution center","MA-DC":"Massachusetts distribution center","OH-DC":"Ohio distribution center","IN-DC":"Indiana distribution center","GA-DC":"Georgia distribution center","TN-DC":"Tennessee distribution center","NY-FC":"New York fulfillment center"}[id]||id);
 const steps=[{title:label(selected.from),detail:scenario.inventory[selected.from]+" units available · release "+scenario.demand.quantity+" unit(s) of "+scenario.demand.sku}];
 if(selected.to!=="customer")steps.push({title:label(selected.to),detail:"Receive inventory and prepare customer pickup or handoff"});
 steps.push({title:selected.to==="customer"?"Customer in "+scenario.demand.destination:"Customer pickup in "+scenario.demand.destination,detail:selected.to==="customer"?"Shipment reaches the customer":"Customer collects the order at the receiving store"});
 steps.forEach((step,i)=>{
  if(i){const arrow=document.createElement("div");arrow.className="flow-arrow";arrow.textContent=i===1?("Selected movement · "+selected.days+" day(s) · $"+selected.cost):"Store pickup / final handoff";host.append(arrow);}
  const el=document.createElement("div");el.className="flow-step";
  const number=document.createElement("span");number.className="step-num";number.textContent=String(i+1);
  const body=document.createElement("div"),name=document.createElement("strong"),description=document.createElement("p");
  name.textContent=step.title;description.textContent=step.detail;body.append(name,description);el.append(number,body);host.append(el);
 });
 const headline=$("benchmark-headline"),takeaway=$("benchmark-takeaway");
 headline.textContent="How the "+scenario.demand.sku+" order gets fulfilled";
 takeaway.textContent="Graph-enabled ChatGPT selected "+label(selected.from)+(selected.to==="customer"?" → customer":" → "+label(selected.to)+" → customer pickup")+". The plan costs $"+selected.cost+" and takes "+selected.days+" day(s). "+(graph.grade.feasible?"It satisfies the modeled operational constraints.":"It violates at least one modeled constraint.");
 if(base&&!base.grade.feasible&&graph.grade.feasible){
  const rejected=scenario.options.find(o=>o.id===base.decision.option_id);
  const warning=document.createElement("div");warning.className="flow-warning";
  warning.textContent="Why not the cheaper route? ChatGPT alone selected "+(rejected?label(rejected.from)+" → "+(rejected.to==="customer"?"customer":label(rejected.to)):"an invalid option")+" ($"+base.grade.cost+"). "+result.context_graph.operational_rules.filter(r=>(r.blocks||[]).includes(base.decision.option_id)).map(r=>r.statement).join(" ")+" The graph-enabled agent avoided that violation.";
  host.append(warning);
 }
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
  renderFulfillmentFlow(result);renderBenchmarkExplanation(result);
  requestAnimationFrame(()=>{try{renderBenchmarkMap(result);}catch(error){$("benchmark-map").textContent="Map failed to load: "+error.message;}});
  status.textContent="Paired experiment complete using "+result.model+". These results are one trial, not proof of a performance difference.";
 }catch(e){status.textContent="Benchmark failed: "+e.message;status.className="error";}
 finally{button.disabled=false;}
});
