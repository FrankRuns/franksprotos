const $ = id => document.getElementById(id);
const endpointKey = "scg-worker-url";
$("endpoint").value = localStorage.getItem(endpointKey) || "";
$("endpoint").addEventListener("change", () => localStorage.setItem(endpointKey, $("endpoint").value.trim()));
let current = null;

function drawGraph(graph) {
 const host=$("graph-map"),detail=$("graph-detail");host.replaceChildren();
 const nodes=(graph.nodes||[]).slice(0,45),ids=new Map(nodes.map((n,i)=>[n.id,i]));
 const edges=(graph.edges||[]).filter(e=>ids.has(e.source)&&ids.has(e.target)).slice(0,75);
 if(!nodes.length){detail.textContent="No entities to display.";return;}
 const W=360,H=Math.max(340,Math.min(620,260+nodes.length*12)),cx=W/2,cy=H/2;
 const ns="http://www.w3.org/2000/svg",svg=document.createElementNS(ns,"svg");
 svg.setAttribute("viewBox","0 0 "+W+" "+H);svg.setAttribute("role","img");svg.setAttribute("aria-label","Interactive supply chain relationship network");
 const positions=nodes.map((n,i)=>{
  if(i===0)return {x:cx,y:cy};
  const angle=i*2.399963229728653;
  const radius=65+Math.sqrt(i/Math.max(1,nodes.length-1))*Math.min(190,H*.36);
  return {x:Math.max(42,Math.min(W-42,cx+Math.cos(angle)*radius)),y:Math.max(35,Math.min(H-35,cy+Math.sin(angle)*radius))};
 });
 const colors={verified:"#6edac8",inferred:"#f2c66d",hypothetical:"#bd9af7",unknown:"#8b9bad"};
 const inspect=(item,kind)=>{
  detail.replaceChildren();
  const h=document.createElement("strong");h.textContent=kind==="node"?(item.label||item.id):((nodes[ids.get(item.source)]?.label||item.source)+" → "+(nodes[ids.get(item.target)]?.label||item.target));detail.append(h);
  const info=document.createElement("p");info.textContent=(item.type||"relationship")+" · "+(item.status||"unknown");detail.append(info);
  const refs=item.evidence_ids||[];
  if(refs.length){const p=document.createElement("p");p.textContent="Evidence: "+refs.join(", ");detail.append(p);}
  const sources=graph.sources||[];
  for(const id of refs){const source=sources.find(s=>s.id===id);if(source){const a=document.createElement("a");a.href=source.url;a.target="_blank";a.rel="noopener noreferrer";a.textContent=source.title||source.url;detail.append(a,document.createElement("br"));}}
 };
 const make=(tag,attrs,parent)=>{const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,String(v));parent.append(el);return el;};
 for(const e of edges){const a=positions[ids.get(e.source)],b=positions[ids.get(e.target)];
  const line=make("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:colors[e.status]||colors.unknown,"stroke-width":2,"stroke-dasharray":e.status==="verified"?"none":"5 5",opacity:".68"},svg);
  line.style.cursor="pointer";line.style.pointerEvents="stroke";line.addEventListener("click",()=>inspect(e,"edge"));
  const hit=make("line",{x1:a.x,y1:a.y,x2:b.x,y2:b.y,stroke:"transparent","stroke-width":14},svg);
  hit.style.cursor="pointer";hit.addEventListener("click",()=>inspect(e,"edge"));
 }
 nodes.forEach((n,i)=>{const p=positions[i],g=make("g",{"class":"node",tabindex:0,role:"button","aria-label":n.label||n.id},svg);
  make("circle",{cx:p.x,cy:p.y,r:i===0?17:12,fill:colors[n.status]||colors.unknown},g);
  const t=make("text",{x:p.x,y:p.y+(i===0?31:24),"text-anchor":"middle"},g);
  const name=n.label||n.id;t.textContent=name.length>19?name.slice(0,17)+"…":name;
  g.addEventListener("click",()=>inspect(n,"node"));g.addEventListener("keydown",ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();inspect(n,"node");}});
 });
 host.append(svg);detail.textContent="Tap a circle or line to see its evidence.";
}

function showGraph(graph, source) {
  drawGraph(graph);
  current = graph;
  $("results").hidden = false;
  $("heading").textContent = graph.company || "Context graph";
  $("counts").textContent = (graph.nodes || []).length + " entities · " + (graph.edges || []).length + " relationships";
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
    const researchResponse = await fetch(endpoint + "/research", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({website:$("company").value})});
    const research = await researchResponse.json();
    if (!researchResponse.ok) throw new Error(research.error || "Research failed");
    stage = "generation";
    $("status").textContent = "Found " + research.source_count + " sources. Asking Qwen to build the graph…";
    const response = await fetch(endpoint + "/generate", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({website:$("company").value})});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    showGraph({...body.graph, sources: body.sources || []}, body.evidence_url || $("company").value);
    $("status").textContent = "Graph generated from " + (body.sources || []).length + " public sources. Review before using.";
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