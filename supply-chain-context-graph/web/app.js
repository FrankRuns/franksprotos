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
 const coords=n=>{const c=n.coordinates||n.location?.coordinates||n.location||{};const geo=n.geometry?.coordinates;const lat=n.lat??n.latitude??c.lat??c.latitude??(Array.isArray(geo)?geo[1]:undefined);const lng=n.lng??n.lon??n.longitude??c.lng??c.lon??c.longitude??(Array.isArray(geo)?geo[0]:undefined);return lat==null||lng==null||lat===""||lng===""?null:[Number(lat),Number(lng)];};
 const nodes=(graph.nodes||[]).filter(n=>{const p=coords(n);return p&&p.every(Number.isFinite)&&Math.abs(p[0])<=90&&Math.abs(p[1])<=180;});
 if(!nodes.length){host.textContent="No verified coordinates in this graph. Add latitude/longitude to facility nodes to see a geographic map. We won't invent locations.";note.textContent="Geographic coverage: 0 located facilities.";return;}
 if(typeof L==="undefined"){host.textContent="Map library unavailable.";return;}
 const map=L.map(host).setView([30,0],3);host._leafletMap=map;
 L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:18,attribution:"© OpenStreetMap contributors"}).addTo(map);
 
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
function companyWebsite(){const value=$("company").value.trim();if(!value)throw Error("Enter a company domain, for example target.com");const url=new URL(/^https?:\/\//i.test(value)?value:"https://"+value);if(!/^https?:$/.test(url.protocol)||!url.hostname.includes("."))throw Error("Enter a valid company domain");return url.href;}
async function loadResearch(endpoint){
 const response=await fetch(endpoint+"/research",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({website:companyWebsite()})});
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
  $("results").hidden = false;
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
  $("generate").disabled = true; $("generate").textContent = "Generating…"; $("status").className = "";
  $("status").textContent = "Checking public research sources…";
  const started = Date.now();
  let stage = "research";
  try {
    const research = await loadResearch(endpoint);
    stage = "generation";
    $("status").textContent = "Found " + research.source_count + " sources. Asking Qwen to build the graph…";
    const response = await fetch(endpoint + "/generate", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({website:companyWebsite(),evidence:research.sources,search_log:research.search_log,web_search_status:research.web_search_status})});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    showGraph({...body.graph, sources: body.sources || []}, body.evidence_url || companyWebsite());
    $("results").scrollIntoView({behavior:"smooth",block:"start"});
    const dropped = body.validation?.dropped_edges_missing_endpoints || 0;
    $("status").textContent = (body.mode === "curated-reference" ? "Sourced facility reference network loaded from " : "Graph generated from ") + (body.sources || []).length + " public sources." + (dropped ? " Removed " + dropped + " invalid relationships with missing entities." : "") + " Review before using.";
    $("status").className = "good";
  } catch(e) { $("status").textContent = "Failed during " + stage + " after " + Math.round((Date.now()-started)/1000) + "s: " + e.message; $("status").className = "error"; }
  finally { $("generate").disabled = false; $("generate").textContent = "Generate context graph"; }
});
$("sample").addEventListener("click", () => {
  showGraph({company:"Illustrative Northeast Supply Chain",nodes:[{id:"plant",label:"Pennsylvania Plant",type:"manufacturer",status:"hypothetical",lat:40.2732,lng:-76.8867},{id:"dc",label:"New Jersey DC",type:"distribution_center",status:"hypothetical",lat:40.7357,lng:-74.1724},{id:"fc",label:"Connecticut Fulfillment Center",type:"fulfillment_center",status:"hypothetical",lat:41.7658,lng:-72.6734},{id:"store",label:"Boston Store",type:"store",status:"hypothetical",lat:42.3601,lng:-71.0589}],edges:[{source:"plant",target:"dc",type:"ships_to",status:"hypothetical"},{source:"dc",target:"fc",type:"ships_to",status:"hypothetical"},{source:"dc",target:"store",type:"ships_to",status:"hypothetical"}],unknowns:["All locations are illustrative city centers, not verified facilities. All lanes are hypothetical."]},"Illustrative network. No real company claims or API calls.");
  $("status").textContent = "";
});
$("download").addEventListener("click", () => {
  if (!current) return;
  const blob = new Blob([JSON.stringify(current,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href=url; a.download="supply-chain-context-graph.json"; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
});


$("graph-file").addEventListener("change",async event=>{
 const file=event.target.files?.[0];if(!file)return;
 try{
  const parsed=JSON.parse(await file.text());
  const graph=parsed.graph&&Array.isArray(parsed.graph.nodes)?parsed.graph:parsed;
  if(!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))throw Error("JSON must contain nodes and edges arrays");
  showGraph(graph,"Loaded locally from "+file.name+". No inference calls.");
  $("status").className="good";$("status").textContent="Saved graph loaded without AI.";
  $("results").scrollIntoView({behavior:"smooth",block:"start"});
 }catch(error){$("status").className="error";$("status").textContent="Could not load graph: "+error.message;}
});
// Load the local illustrative map without calling a model.
$("sample").click();
