#!/usr/bin/env python3
"""Evidence-first company supply-chain research experiment.

Requires BRAVE_SEARCH_API_KEY and OPENAI_COMPATIBLE_API_KEY, plus
OPENAI_COMPATIBLE_BASE_URL pointing at an OpenAI-compatible open-weight model host.
No secrets are stored in the repository.
"""
import argparse, datetime as dt, json, os, pathlib, re, time, urllib.parse, urllib.request

TOPICS = {
 "network": "distribution centers manufacturing plants warehouses facility locations addresses",
 "sourcing": "suppliers sourcing countries manufacturing supply chain imports",
 "transport": "ports logistics carriers transportation intermodal inbound freight",
 "fulfillment": "distribution network customers stores fulfillment last mile",
 "operations": "inventory replenishment capacity lead times operational constraints",
 "changes": "2025 2026 supply chain factory warehouse expansion closures",
}
SYSTEM = """You are a supply chain network research analyst. Use ONLY the supplied numbered web excerpts.
Write a detailed research section with headings: Verified facts; Inferences; Unknowns; Potential graph nodes and edges.
Cite each substantive claim with [S#]. Never invent a facility, address, volume, lane, or service level.
Mark inferences explicitly. Distinguish a source's assertion from independent verification.
Return clear markdown. If evidence is insufficient, say so."""
def request_json(url, headers=None, payload=None, timeout=75):
    body=None if payload is None else json.dumps(payload).encode()
    req=urllib.request.Request(url,data=body,headers=headers or {},method="POST" if body else "GET")
    with urllib.request.urlopen(req,timeout=timeout) as resp:
        return json.load(resp)
def search(query, count=8):
    key=os.environ["BRAVE_SEARCH_API_KEY"]
    params=urllib.parse.urlencode({"q":query,"count":count})
    result=request_json("https://api.search.brave.com/res/v1/web/search?"+params,{"X-Subscription-Token":key,"Accept":"application/json"})
    return [{"title":x.get("title",""),"url":x.get("url",""),"snippet":re.sub("<[^>]+>","",x.get("description",""))} for x in result.get("web",{}).get("results",[])]
def infer(messages,usage):
    base=os.environ["OPENAI_COMPATIBLE_BASE_URL"].rstrip("/")
    key=os.environ["OPENAI_COMPATIBLE_API_KEY"]
    model=os.environ.get("OPENAI_COMPATIBLE_MODEL","Qwen/Qwen3-30B-A3B")
    response=request_json(base+"/chat/completions",{"Authorization":"Bearer "+key,"Content-Type":"application/json"},{"model":model,"messages":messages,"temperature":0.1,"max_tokens":4000},timeout=240)
    u=response.get("usage",{})
    usage["input_tokens"]+=u.get("prompt_tokens",0);usage["output_tokens"]+=u.get("completion_tokens",0)
    usage["calls"]+=1
    return response["choices"][0]["message"]["content"]
def main():
    p=argparse.ArgumentParser();p.add_argument("company");p.add_argument("--website",default="");p.add_argument("--out",default="research-output");p.add_argument("--max-searches",type=int,default=12)
    a=p.parse_args()
    if a.max_searches<1: p.error("--max-searches must be positive")
    for k in ("BRAVE_SEARCH_API_KEY","OPENAI_COMPATIBLE_API_KEY","OPENAI_COMPATIBLE_BASE_URL"):
        if not os.getenv(k): p.error("Missing environment variable "+k)
    started=time.monotonic();folder=pathlib.Path(a.out)/re.sub(r"[^a-z0-9]+","-",a.company.lower()).strip("-");folder.mkdir(parents=True,exist_ok=True)
    searches=[];sources=[];seen=set()
    for topic,terms in list(TOPICS.items())[:a.max_searches]:
        q=f'{a.company} {a.website} {terms}'.strip()
        try: results=search(q)
        except Exception as exc: searches.append({"topic":topic,"query":q,"error":str(exc)});continue
        searches.append({"topic":topic,"query":q,"count":len(results)})
        for r in results:
            if r["url"] and r["url"] not in seen:
                seen.add(r["url"]);sources.append(dict(r,id=f"S{len(sources)+1}",topic=topic))
    evidence="\n".join(f'[{s["id"]}] {s["title"]} | {s["url"]} | {s["snippet"]}' for s in sources)
    (folder/"sources.json").write_text(json.dumps({"company":a.company,"website":a.website,"searches":searches,"sources":sources},indent=2))
    usage={"calls":0,"input_tokens":0,"output_tokens":0}
    sections=[]
    for topic in TOPICS:
        subset=[s for s in sources if s["topic"]==topic]
        if not subset: sections.append(f"## {topic.title()}\nNo retrieved evidence.");continue
        excerpt="\n".join(f'[{s["id"]}] {s["title"]} | {s["url"]} | {s["snippet"]}' for s in subset)
        try: section=infer([{"role":"system","content":SYSTEM},{"role":"user","content":f"Company: {a.company} ({a.website}). Topic: {topic}. Search-result excerpts (not full pages):\n{excerpt}"}],usage)
        except Exception as exc: section=f"Research section failed: {exc}"
        sections.append(f"## {topic.title()}\n\n{section}")
    dossier=f"# {a.company} | Preliminary supply chain research\n\nGenerated {dt.datetime.now(dt.timezone.utc).isoformat()}. This is an evidence-triage draft based on search snippets, not a verified deep research report. Validate primary sources before treating claims as facts.\n\n"+"\n\n".join(sections)+"\n\n## Sources\n\n"+"\n".join(f'- [{s["id"]}] {s["title"]}: {s["url"]}' for s in sources)
    (folder/"research.md").write_text(dossier)
    manifest={"company":a.company,"website":a.website,"timestamp":dt.datetime.now(dt.timezone.utc).isoformat(),"elapsed_seconds":round(time.monotonic()-started,2),"search_queries":len(searches),"unique_sources":len(sources),"usage":usage,"model":os.environ.get("OPENAI_COMPATIBLE_MODEL","Qwen/Qwen3-30B-A3B"),"cost_usd":None,"limitations":["Search snippets only; not full-page research","Claims not independently verified","Graph compilation not yet implemented"]}
    (folder/"run.json").write_text(json.dumps(manifest,indent=2))
    print(json.dumps({"output":str(folder),"metrics":manifest},indent=2))
if __name__=="__main__":main()
