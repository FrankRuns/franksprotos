# Company research agent (backend foundation)

This folder defines the reusable, company-independent research contract for Supply Chain Machine.

## Pipeline
1. Normalize and validate company URL (backend blocks private network destinations).
2. Collect product pages, manufacturer information, public company filings and verifiable price evidence.
3. Select a physical base unit (jar, case, pallet, appliance) and distinguish it from shipping units.
4. Produce assumptions with source URLs, observed vs estimated status, and confidence.
5. Validate unit economics against price benchmarks and flag implausible or incomplete costs.
6. Return a company-model JSON payload to the deterministic calculation engine.

Do not infer annual volume from retail price. Do not treat retail price as manufacturer's revenue. Do not fabricate source URLs. Costs absent from research must be null, not zero. Unknown facility locations must not become invented map pins.

## Status
This is the agent contract and validation layer, **not** a deployed research service. The static GitHub Pages site cannot securely hold API credentials or conduct server-side research. Next integration: hosted POST /api/research-company service that uses web research + LLM structured output and validates the response with model-contract.mjs.
