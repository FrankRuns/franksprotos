# Supply Chain Context Graph

An industry-agnostic, evidence-first system that combines reusable supply-chain knowledge with company-specific public information to produce an editable, agent-readable context graph.

## Core separation
- `knowledge/`: universal ontology, network patterns, operating rules, inference policy.
- `companies/`: company-specific evidence and graphs. Target is the first test, not a schema assumption.
- `pipeline/`: evidence ingestion, extraction, validation and graph construction.
- `tests/`: structural and evidence checks.

## Evidence policy
Never treat a common network pattern as proof of a specific company relationship. Every factual node or edge must have a source reference; hypothetical or inferred records must be explicitly marked. Unknown connections stay unknown. Separate physical flow, capability, policy and ownership relationships.

## Build sequence
1. Validate ontology and sample graph.
2. Collect Target primary-source evidence with dated URLs and quoted supporting spans.
3. Implement deterministic extraction/validation, then LLM extraction.
4. Benchmark small open-weight LLM with and without curated knowledge against a stronger model.
5. Add human editing, provenance, and JSON export.

No live web research, hosted inference, or deployment is included in this initial scaffold.
