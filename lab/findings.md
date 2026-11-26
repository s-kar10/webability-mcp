# Findings from November 13

## Observed on real local WordPress

- The dashboard embed loaded with HTTP 200 and was classified present. This checks script installation only; domain licensing/widget activation was not assessed.
- Escaped code in content was classified not_installed. Correct state, but no explanation of the wrong slot and no owner repair step is returned by the current tool.
- Enforced CSP correctly returned blocked with script URL, script-src-elem and the actual policy.
- A primed stale page correctly returned not_installed after the install option was enabled. The tool cannot determine the cache cause from public absence alone.
- Restoring the live head embed and purging the named lab cache made every case return present.

State scoring: 3 right / 0 wrong / 0 unknown across broken cases. Explanation cause scoring: 1 right / 0 wrong / 2 unknown. This is evidence review, not usability success. The tool does not currently return the one-sentence/one-next-step owner guidance.

Seven valid checks (control + three broken + three repaired) took about 1.8–2.5 seconds end to end in this local environment. These are single observations, not a benchmark and not GTM timing. No 10-second cross-builder claim is established.

## Setup issue retained in the audit trail

The first WordPress CLI call omitted the `wp` executable. A premature control call reached the installer and returned not_installed. The setup command was corrected and the CMS was installed before any valid control/failure run. Both initial run IDs are retained privately and listed as excluded in the manifest. They are not scored as install cases.

## Pending and maintainer-owned

Sid's hostname correction is already included as 991c6ed; no independent source change was made. No detector fixes were attempted in this lab branch.
Cross-origin exceptions without crossorigin and delayed GTM injection remain measurements to perform. Real GTM/consent accounts and other builders do not exist yet. No participant trials or recordings have occurred.

## November 19–20 extension

Accounts now exist; this supersedes the earlier pending-account note above. See setup.md for exact status. Wix and Framer healthy controls returned present with HTTP 200. No detector or hostname changes were made.

Six broken cases across real WordPress and Framer: **6 right / 0 wrong / 0 unknown** for observed installation state; **2 right / 0 wrong / 4 unknown** for explanatory cause. The latter scores assess whether the evidence supports the cause, not whether a non-technical owner can fix it. Wrong slot, stale cache, unpublished GTM and unpublished Framer changes cannot be uniquely explained from public absence. The consent case's repair run is a deliberate-config rollback; allowed-consent release was inspected in the browser DOM only.

WordPress owner controls were exercised by the agent for all three repairs, each followed by present. At this stage no participant outcomes had been reported. Later, the user reported two friends independently completed the WordPress wrong-slot repair in about 2–3 minutes each, without hints. Other participant cases and revised-wording retests remain pending.

### GTM timing, November 19

Real published version 2, All Pages / Page View, no CMP installed during this run. Five fresh contexts and five loads in a primed context, independent 30-second window each. All ten observed the widget. Request-time median/max: fresh **246.58 / 379.02 ms**, warm **70.06 / 90.60 ms**. None exceeded 10 seconds; none unknown. Request, insertion and download-completion timings remain in raw samples. Different time origins are documented in run.json. Warm context does not prove a cache hit for every resource.

The successful GTM tool rerun took 2433.40 ms including server startup. The immediate post-publication check was absent; preserved as a failed repair attempt, with later success rather than silently replaced. These small samples on one site do not establish the general 10-second goal.

### Remaining gaps

Shopify password gate prevents storefront scoring. Wix has a healthy control but no broken case yet. Cookiebot permanent Free status is pending after its default trial. Participant testing, wording revisions and recordings/six-case live demo remain incomplete. Six reproduced cases do not imply completion of all 24 matrix cells or meaningful failure coverage on four builders.

## November 24 revalidation (Toronto)

Integrated Sid’s existing detector fixes through 74b254c into the lab branch at merge 99e66db. No independently authored detector changes. Full suite: **575 passed, 0 failed, 0 skipped**; typecheck and build passed. Built stdio server initialized, listed 21 tools and included check_install. Raw IDs use November 25 UTC, not a different local work date.

On this baseline, WordPress wrong-slot/CSP/cache returned not_installed/blocked/not_installed, followed by present for every repair. State scores remain three right; cause explanations remain one right and two unknown. The final local configuration is healthy. Wix and Framer public controls returned present. Their calls overlapped repository testing; these durations are not a standalone latency benchmark.

The Shopify check again ended at /password; storefront state remains unknown. Chrome dashboard tools were unavailable in the execution session despite user authorization. Consequently no Wix broken configuration, Framer broken-state rerun, Cookiebot subscription change, consent-preserving network proof or final-configuration GTM timing is claimed. November 19–20 results remain historical, not current-baseline revalidation.

See [revalidation index](cases/revalidation-2026-11-24.json) for run IDs and pending items. Technical evidence remains in the repository; personal participant records and communication/recording drafts are now delivered outside Git. Recordings and the full four-builder milestone remain incomplete.

## November 25–26 continuation

Wix now has a real enforced-meta-CSP failure and verified narrow-origin repair: present → blocked → present. The blocked response includes the actual policy and directive. This brings historical distinct broken cases to seven across three builders, with state scores 7 right / 0 wrong / 0 unknown and cause scores 3 right / 0 wrong / 4 unknown. These aggregate scores cover stable cases across different dated baselines; they exclude deployment transitions.

Framer consent returned blocked on the current baseline. Chrome confirmed the real Cookiebot Preferences choice changes the tag to executable JavaScript, but consent-preserving HTTP-success evidence is still outstanding. The subsequent GTM-only deployment returned present, not_installed under empty live version 1, and present after restoring version 2. An immediate check during the transition still saw present and is retained without calling it a detector miss. This is a live-version rollback equivalent, not another never-published tag.

See [revalidation and reset notes](cases/revalidation-2026-11-26.md). No detector code changed. Participant trials and recordings remain separate unfinished deliverables.


Corrected ten-load run `2026-11-26T23-32-04-348Z-gtm-4e0c76f0`: fresh request median 283.73 ms, maximum 311.27 ms; warm median 103.09 ms, maximum 110.63 ms. All 10 observed; none exceeded 10 seconds. Each sample observed for 30 seconds. These are navigation-to-widget-request timings, not total check_install duration or a guarantee for other GTM configurations.
Framer unpublished-change rerun also completed: not_installed before publishing, present/HTTP 200 after publishing; see current revalidation notes.

Consent repair network proof completed November 26: after granting Preferences via the real Cookiebot banner, Chrome Network showed HTTP 200 for widget.min.js and its bootstrap. Fresh MCP still reports blocked because its browser has no consent; this is expected. See the manual UI observation in current revalidation notes.
