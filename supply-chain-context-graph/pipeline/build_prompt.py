"""Assemble the reusable knowledge and company evidence into a constrained extraction request."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
KNOWLEDGE = [
    "knowledge/ontology/entities.json",
    "knowledge/ontology/relationships.json",
    "knowledge/ontology/capabilities.json",
    "knowledge/network_patterns/patterns.json",
    "knowledge/operating_rules/rules.json",
    "knowledge/inference/policy.json",
    "knowledge/inference/playbooks.json",
    "knowledge/industry_profiles/profiles.json",
]

def build_messages(company_name, evidence):
    kb = {path: json.loads((ROOT / path).read_text()) for path in KNOWLEDGE}
    instruction = (
        "You construct evidence-backed supply-chain context graphs. "
        "Use reusable knowledge only for interpretation, never as proof of company-specific facts. "
        "Return a JSON object with nodes, edges, unknowns. "
        "Each verified node or edge must cite evidence IDs from the supplied evidence. "
        "Do not invent facilities, lanes, capacities, contracts or flow volumes. "
        "Mark inferred and hypothetical relationships explicitly."
    )
    return [
        {"role": "system", "content": instruction},
        {"role": "user", "content": json.dumps({"company": company_name, "knowledge": kb, "evidence": evidence})},
    ]
