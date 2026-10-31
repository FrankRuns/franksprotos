const $ = id => document.getElementById(id);
const endpointKey = "scg-worker-url";
$("endpoint").value = localStorage.getItem(endpointKey) || "";
$("endpoint").addEventListener("change", () => localStorage.setItem(endpointKey, $("endpoint").value.trim()));
let current = null;
function showGraph(graph, source) {
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
  $("status").textContent = "Fetching public evidence and generating graph…";
  try {
    const response = await fetch(endpoint + "/generate", {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({website:$("company").value})});
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "Request failed");
    showGraph({...body.graph, sources: body.sources || []}, body.evidence_url || $("company").value);
    $("status").textContent = "Graph generated from " + (body.sources || []).length + " public sources. Review before using.";
    $("status").className = "good";
  } catch(e) { $("status").textContent = e.message; $("status").className = "error"; }
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