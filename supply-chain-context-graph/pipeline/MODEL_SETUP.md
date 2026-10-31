# Hosted open-weight model setup

Recommended first candidate: Qwen/Qwen3-4B-Instruct-2507 through an OpenAI-compatible hosted inference provider. Verify provider model availability and JSON mode support before use. Keep the provider key in environment variables, never in Git.

Example (Hugging Face routed inference; endpoint compatibility must be verified with a live call):

```bash
export SCG_LLM_BASE_URL=https://router.huggingface.co/v1
export SCG_LLM_MODEL=Qwen/Qwen3-4B-Instruct-2507
export SCG_LLM_API_KEY=YOUR_HF_TOKEN
cd supply-chain-context-graph
python -m unittest discover -s tests -v
python pipeline/run_graph.py --company "Fictional Company" --evidence companies/target/evidence.sample.json --output /tmp/graph.json
```

The sample evidence is explicitly fictional and should not be used as Target evidence.

**Not yet performed:** authenticated live call, price measurement, latency measurement, actual Target evidence ingestion. The command requires a real token and compatible provider. The graph validator checks structural references but not whether a cited passage semantically proves a claim. That needs an evidence entailment check and human review.

Benchmark next: same evidence with and without curated knowledge, then a stronger reference model. Record input/output tokens, wall time, provider, model revision, validity, unsupported claims and cost.
