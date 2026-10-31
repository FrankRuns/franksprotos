const $ = id => document.getElementById(id);
const endpointKey = "scg-worker-url";
$("endpoint").value = localStorage.getItem(endpointKey) || "";
$("endpoint").addEventListener("change", () => localStorage.setItem(endpointKey, $("endpoint").value.trim()));
let current = null;

function drawGraph(graph) {
 const host=$("graph-map"),detail=$("graph-detail");host.replaceChildren();
 const all=graph.nodes||[], types=/supplier|vendor|manufacturer|port|inbound|facility_group|warehouse|distribution|fulfillment|sortation|receive|flow.center|store|customer|market|facility|plant|factory|transport/i;
 const nodes=all.filter(n=>types.test((n.type||"")+" "+(n.label||""))).slice(0,35);
 if(!nodes.length){detail.textContent="No physical supply chain entities identified. Research more sources before drawing a network.";return;}
 const ids=new Map(nodes.map((n,i)=>[n.id,i]));
 const flowTypes=/ships_to|can_ship_to|supplies|replenishes|delivers_to|transports_to|fulfills|flows_to|distributes_to/i;
 const edges=(graph.edges||[]).filter(e=>ids.has(e.source)&&ids.has(e.target)&&flowTypes.test(e.type||e.relationship||""));
 const stage=n=>{const s=((n.label||"")+" "+(n.type||"")).toLowerCase();
  if(/supplier|vendor|manufacturer|factory|plant|port|import/.test(s))return 0;
  if(/receive|upstream|inbound/.test(s))return 1;
  if(/distribution|warehouse|flow.center|dc\b/.test(s))return 2;
  if(/sortation|fulfill|store|retail/.test(s))return 3;
  if(/customer|guest|market|region/.test(s))return 4;
  return 2;
 };
 const columns=[[],[],[],[],[]];nodes.forEach((n,i)=>columns[stage(n)].push(i));
 const maxRows=Math.max(...columns.map(x=>x.length),1),W=780,H=Math.max(280,105+maxRows*76),ns="http://www.w3.org/2000/svg";
 const svg=document.createElementNS(ns,"svg");svg.setAttribute("viewBox",`0 0 ${W} ${H}`);svg.setAttribute("role","img");svg.setAttribute("aria-label","Supply chain stages from suppliers to customers");
 svg.style.minWidth="650px";svg.style.height=H+"px";
 host.style.overflowX="auto";
 const make=(tag,attrs,parent)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));parent.append(el);return el;};
 const stages=["Suppliers","Inbound","Distribution","Fulfillment","Customers"];
 const positions=new Map();
 stages.forEach((name,i)=>{const x=82+i*154;const title=make("text",{x,y:25,"text-anchor":"middle",fill:"#8ce3c2","font-size":13,"font-weight":700},svg);title.textContent=name;
  columns[i].forEach((index,j)=>{positions.set(nodes[index].id,{x,y:75+j*76});});
 });
 const sources=graph.sources||[];
 function inspect(item,edge=false){detail.replaceChildren();const heading=document.createElement("strong");heading.textContent=edge?((all.find(n=>n.id===item.source)?.label||item.source)+" → "+(all.find(n=>n.id===item.target)?.label||item.target)):(item.label||item.id);detail.append(heading);
  const p=document.createElement("p");p.textContent=(item.type||"")+" · "+(item.status||"unknown");detail.append(p);
  if(!edge){const context=(graph.operating_context||[]).filter(x=>x.subject_id===item.id);for(const rule of context){const block=document.createElement("p");block.textContent=(rule.kind||"Context")+": "+rule.statement+" ("+rule.status+")";detail.append(block);}
  const connected=(graph.edges||[]).filter(e=>e.source===item.id||e.target===item.id);const info=document.createElement("p");info.textContent=connected.length+" recorded relationships. Physical flows require separate evidence.";detail.append(info);}
  for(const ref of item.evidence_ids||[]){const s=sources.find(x=>x.id===ref);if(s){const a=document.createElement("a");a.href=s.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=s.title||s.url;detail.append(a,document.createElement("br"));}}
 }
 for(const e of edges){const a=positions.get(e.source),b=positions.get(e.target);if(!a||!b)continue;
  const line=make("path",{d:`M ${a.x+48} ${a.y} C ${(a.x+b.x)/2} ${a.y}, ${(a.x+b.x)/2} ${b.y}, ${b.x-48} ${b.y}`,fill:"none",stroke:e.status==="verified"?"#6edac8":"#f2c66d","stroke-width":2,"stroke-dasharray":e.status==="verified"?"none":"5 5"},svg);line.style.cursor="pointer";line.addEventListener("click",()=>inspect(e,true));
 }
 for(const n of nodes){const p=positions.get(n.id);const g=make("g",{role:"button",tabindex:0,"aria-label":n.label||n.id},svg);g.style.cursor="pointer";
  make("rect",{x:p.x-52,y:p.y-21,width:104,height:42,rx:8,fill:"#253e51",stroke:n.status==="verified"?"#6edac8":n.status==="inferred"?"#f2c66d":"#a2aabb","stroke-width":2},g);
  const t=make("text",{x:p.x,y:p.y+4,"text-anchor":"middle",fill:"#edf5fa","font-size":11},g);const label=n.label||n.id;t.textContent=label.length>17?label.slice(0,15)+"…":label;
  g.addEventListener("click",()=>inspect(n));g.addEventListener("keydown",ev=>{if(ev.key==="Enter"){inspect(n);}});
 }
 host.append(svg);
 detail.textContent=edges.length?"Tap a facility or flow to inspect evidence. Scroll sideways for all stages.":"No documented product-flow relationships yet. Facilities are shown by stage, without inventing lanes. Tap a facility to inspect evidence.";
}

function showGraph(graph, source) {
  drawGraph(graph);
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
  $("generate").disabled = true; $("results").hidden = true; $("status").className = "";
  $("status").textContent = "Checking public research sources…";
  const started = Date.now();
  let stage = "research";
  try {
    const isTarget = false;
    const researchResponse = isTarget ? null : await fetch(endpoint + "/research", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({website:$("company").value})});
    const research = researchResponse ? await researchResponse.json() : {source_count:0,sources:[]};
    if (researchResponse && !researchResponse.ok) throw new Error(research.error || "Research failed");
    stage = "generation";
    $("status").textContent = isTarget ? "Loading sourced Target facility reference network…" : "Found " + research.source_count + " sources. Asking Qwen to build the graph…";
    const response = await fetch(endpoint + "/generate", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({website:$("company").value,evidence:research.sources})});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    showGraph({...body.graph, sources: body.sources || []}, body.evidence_url || $("company").value);
    const dropped = body.validation?.dropped_edges_missing_endpoints || 0;
    $("status").textContent = (body.mode === "curated-reference" ? "Sourced facility reference network loaded from " : "Graph generated from ") + (body.sources || []).length + " public sources." + (dropped ? " Removed " + dropped + " invalid relationships with missing entities." : "") + " Review before using.";
    $("status").className = "good";
  } catch(e) { $("status").textContent = "Failed during " + stage + " after " + Math.round((Date.now()-started)/1000) + "s: " + e.message; $("status").className = "error"; }
  finally { $("generate").disabled = false; }
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