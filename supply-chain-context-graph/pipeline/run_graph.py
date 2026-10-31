"""CLI: evidence JSON -> LLM -> validated graph JSON."""
import argparse
import json
import time
from pathlib import Path
from build_prompt import build_messages
from llm_client import generate_json

def validate(graph, evidence):
    if not isinstance(graph, dict) or not isinstance(graph.get("nodes"), list) or not isinstance(graph.get("edges"), list):
        raise ValueError("Expected JSON object with nodes and edges arrays")
    valid_evidence = {e["id"] for e in evidence if isinstance(e, dict) and "id" in e}
    ids = set()
    for node in graph["nodes"]:
        if not isinstance(node, dict) or not isinstance(node.get("id"), str) or not node["id"]:
            raise ValueError("Each node requires a nonempty string id")
        if node["id"] in ids:
            raise ValueError("Duplicate node id")
        ids.add(node["id"])
    for record in graph["nodes"] + graph["edges"]:
        status = record.get("status")
        if status not in ("verified", "inferred", "hypothetical", "unknown"):
            raise ValueError("Invalid or missing status")
        refs = record.get("evidence_ids", [])
        if not isinstance(refs, list) or any(ref not in valid_evidence for ref in refs):
            raise ValueError("Unknown evidence reference")
        if status == "verified" and not refs:
            raise ValueError("Verified claims require evidence")
    for edge in graph["edges"]:
        if edge.get("source") not in ids or edge.get("target") not in ids:
            raise ValueError("Edge endpoint missing from nodes")
    return graph

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--company", required=True)
    parser.add_argument("--evidence", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    evidence = json.loads(Path(args.evidence).read_text())
    if not isinstance(evidence, list):
        raise ValueError("Evidence must be a JSON list")
    start = time.monotonic()
    result = generate_json(build_messages(args.company, evidence))
    validate(result, evidence)
    Path(args.output).write_text(json.dumps(result, indent=2))
    print(json.dumps({"nodes": len(result["nodes"]), "edges": len(result["edges"]), "elapsed_seconds": round(time.monotonic()-start,2)}))

if __name__ == "__main__":
    main()
