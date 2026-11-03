# Ski Season Planner

Portable source export of the winter 2026–27 planner, including its MIP solver, input snapshots, map, compact calendar, and historical condition graph.

## Run locally

From this directory, run `python3 -m http.server 8000`, then open http://localhost:8000/ . No build or API key is needed; serve through HTTP rather than double-clicking the HTML file. Map tiles and uncached road geometry require internet. Settings are saved only in the current browser.

For model checks, run `npm ci` followed by `npm test` (Node 20+ recommended). Use `dist/` as the static web root when deploying, or keep the root redirect for GitHub Pages.

The published Site identity and credentials are excluded. Origin is an approximate Simsbury, CT town point, not a residential address. The supplied default schedule is a planning snapshot with estimated prices and editable resort operating windows; its condition scores are not probabilities or forecasts.

## Project notes

Static planner for winter 2026–27. Open `dist/index.html` through a static web server. The GLPK browser worker solves the binary model locally, in two lexicographic phases: maximize integer-scaled quality, then minimize cost while preserving that score.

`dist/model.js` contains the complete formulation and itinerary generation. `fetch_data.py` reproduces the weather and routing snapshot using Open-Meteo ERA5 and OSRM. Historical daily data is included in `dist/weather-raw/`. `npm test` validates the model against the bundled snapshot. All road times include a configurable traffic allowance. No traffic forecast or hotel booking API runs on page load.

Operating dates, lodging rates, mountain preference, crowd factors and parking prices are assumptions. Passes are assumed already owned for everyone (Indy+ two included days per resort; unrestricted Epic). Reservations must be confirmed separately. Cost outputs exclude pass purchase, rentals, tolls and vehicle wear unless added as extras. No budget constraint.

Weekends default active. Longer trips include two nights at one lodging base. Saturday and Sunday mountains may differ. Home Sunday by 20:00; departure Friday >=17:00. All constraints and objective coefficients are inspectable in Model & sources. Input and model downloads are available in the application.

GLPK.js is GPL-3.0 licensed; source is available at https://github.com/jvail/glpk.js . This project is also distributed under GPL-3.0. Open-Meteo data: CC BY 4.0; OSM data: ODbL attribution in the app.

## Snowpack-aware condition score

The default condition index uses 40% monthly reported base depth (saturating at 24 inches), 40% observed terrain-open fraction when at least three reports exist, and 20% recent snow/rain. Missing components are unknown and their weights are redistributed. Terrain counts below the threshold remain visible but do not contribute. Weights, saturation and sample threshold are editable. The original weather-only mode is retained for comparison. Scores between modes use different scales and are not evidence of a measured improvement in ski enjoyment.

`fetch_snow_history.py` retrieves OnTheSnow monthly historic depths for all 19 mountains. `fetch_terrain_history.py` retrieves NewEnglandSkiHistory volunteer terrain aggregates and recorded seasonal operating dates where available. Each record includes its source and retrieval date. Monthly depth aggregates do not disclose their underlying period/sample size. Terrain observations are sparse, nonrandom and may describe only open days; report counts are displayed. Historical opening/closing dates are evidence, not guaranteed 2026–27 dates or continuous operating intervals. Future date windows remain editable assumptions.

Run `python build_conditions.py` after refreshing any data snapshot (including after `fetch_data.py`) to attach the sourced evidence and recompute surface indices from the bundled daily weather. Surface proxy is mean clamp(0.65 + 0.25 min(7-day snow cm / 25, 1) − 0.30 min(3-day rain mm / 15, 1), 0.05, 1). Temperature alone has no penalty. The disruption term is the fraction of daily surface proxies below 0.45, scaled by the effective weather weight. Neither component is a calibrated probability or forecast.

Default snapshot with the 70/100 minimum: 28 days, estimated $9,089, Jay January 2–3, Magic April 3–4 and Bolton April 10–11. These dates require actual resort operating/reservation confirmation. No constraint forces Jay into April. New January/April Jay condition indices are approximately 88/78, versus 75/45 in original mode for those weekend bins. Its reported base is 21/22 inches and terrain-open mean 97%/76% (7/19 reports).

## Route maps and required Magic trip

Route maps use locally bundled Leaflet and OSRM road geometry. Default road legs are cached by `cache_routes.py` into `dist/road-routes.json`; uncached changed itineraries fetch OSRM road geometry in the browser. OpenStreetMap tiles load from the public tile service. Directional trip legs match the optimizer and include both hotel nights.

Every Indy capacity is hard capped at two, including saved browser inputs. The MIP requires exactly one Magic Saturday/Sunday itinerary with seven hours each day. The UI can select the date automatically or pin an active weekend. Infeasible requirements produce an error. A post-solve audit also checks all pass capacities and the Magic requirement.

## Season variety constraint

Every mountain, including unrestricted Epic mountains, has a separate hard limit of two planned ski days per season. This is independent of pass access and enforced both in the MIP and in the post-solve audit. Some active weekends can remain unscheduled when eligible mountains are exhausted.

## Added lodging coverage

Added six town-center lodging bases: Newbury, Sunapee town, Hunter town, Tannersville, Waterville Valley town and Plymouth. Each has directional road times/distances to every other node in the 38-location routing matrix. Their nightly rates remain explicitly labeled planning estimates. Regression checks ensure that Sunapee, Hunter and Waterville have feasible same-mountain weekend itineraries using the new bases.

## Minimum and weekly season graph

Every ski day must meet an editable minimum index (default 70/100). This is a hard itinerary eligibility rule, independent of cost and preference. Staying home is allowed; a minimum that excludes all eligible Magic dates produces an error.

Season conditions shows one graph from December 1 through April 30 in continuous seven-day periods. Each mountain point averages its modeled daily indices in that period, using the bundled weekly weather bins and monthly evidence. The median and interquartile band give equal weight to all 19 mountains, regardless of pass, distance, enabled status or solver allocation. Magic, Bolton and Jay appear separately. The band is cross-mountain variation, not uncertainty. The SVG can be downloaded for readers. It is a modeled index rather than empirical probability of great skiing or resort operation.
