# Failure protocol and scoring

1. Record builder/plan, site URL, published theme/version, the actual supplied embed snippet, and configuration proof. Keep account screenshots private.
2. Establish a healthy control. Presence is script loading, not proof of widget licensing/activation or WCAG conformance.
3. Change exactly one installation condition. Do not simulate real builder results with intercepted browser requests.
4. Capture independent ground truth: published configuration, served page HTML, CSP header/violation, cache header/version, or published GTM version. Public page absence cannot distinguish draft theme, unpublished tag, and stale cache.
5. Run check.mjs. Retain errors as evidence; don't overwrite them with retries.
6. Manually score state accuracy and explanation usefulness separately. Right = evidence agrees and no unsupported cause; wrong = contradiction or misleading advice; unknown = evidence is insufficient. Unrun rows stay null.
7. Repair the configuration, capture it, and rerun under a new run ID. Link control → broken → repaired run IDs in matrix.json.
8. Record exact reset steps and configuration proof for later recordings.

## Coverage constraints

Four builders × six failures is a 24-cell coverage matrix, not 24 claimed completions.
Use planned / reproduced / access-blocked / not applicable with a reason. Not-applicable needs a verified platform reason, not simply lack of time.
Cookiebot requires a real account and configuration. Handwritten type=text/plain is a unit fixture, not the required consent lab.
GTM requires an installed real container, unpublished workspace tag and published control version. Do not claim the tool knows workspace publication state.
Draft-theme equivalents must be labelled (e.g. unpublished page/site changes). Self-hosted WordPress means the actual CMS, not a static HTML page.
WordPress's minimal cache fixture models an actual stale full-page response; it is not evidence about a branded cache/CDN service.

## Timing

Pair each real GTM timing session with fresh check.mjs invocations and retain both IDs. Run five fresh contexts and five warm loads with gtm-timing.mjs.
Supply actual container ID, published version, trigger and initial consent state. The runner never grants consent; if the site changes cookies during loads, capture that state independently and label it.
GTM injection timing is independent of check_install's observation duration. Observe for 30 seconds, reporting missing events as null/unknown, never zero.
Report medians, maxima, missing counts and observed request times >10 seconds. Navigation failures are excluded from latency summaries and included in unknown counts.
No client-side routing is installed, since routing can disable the HTTP cache. Warm priming is labelled separately.

## Maintainer-owned issue

Sid's hostname correction landed on the PR branch as 991c6ed on November 12.
The lab baseline includes that commit; no independent detector modification is part of this lab.
Keep older run commits explicit if reproducing the historical miss. Cross-origin runtime masking and late GTM injection remain limits to measure, not erase from results.
