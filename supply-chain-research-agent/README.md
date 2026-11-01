# Supply Chain Research Agent (experiment)

Goal: Generate an evidence-backed company supply chain dossier using a low-cost open-weight model, then eventually compile it to a geographic context graph.

## Run

Python 3.10+ (standard library only). Set environment variables locally or in a secure runner:

- `BRAVE_SEARCH_API_KEY` for web discovery
- `OPENAI_COMPATIBLE_BASE_URL` for an OpenAI-compatible hosted open-weight model endpoint, including `/v1`
- `OPENAI_COMPATIBLE_API_KEY` for that inference host
- `OPENAI_COMPATIBLE_MODEL` optional (default `Qwen/Qwen3-30B-A3B`; exact provider model IDs vary)

```bash
python research.py "3M" --website https://www.3m.com --max-searches 6
```

Output under `research-output/3m/`: `sources.json`, `research.md`, `run.json`. Never commit credentials. `run.json` logs tokens and elapsed time, but **cost is unknown** until host and search pricing are supplied.

## Current limitations

This is **stage 0**, not a Claude-quality deep research agent. It uses Brave search result snippets, not the underlying documents, so citations and claims need verification. It does not yet crawl SEC filings, extract full PDFs, reconcile contradictions, compile a graph, or run a second independent fact checker. There is no successful 3M run recorded yet. The cap controls search queries, not the number of sources or exact spend.

## Next milestones

1. Run on 3M with a hosted open-weight model and capture actual cost and timing.
2. Retrieve full primary-source pages and filings, with per-claim source anchors.
3. Build evidence ledger, entity deduplication and confidence review.
4. Compile graph JSON and compare evidence quality with the Target dossier.
5. Add caching and background jobs before website integration.
