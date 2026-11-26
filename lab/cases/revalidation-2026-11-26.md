# Real-builder checks — November 25–26, Toronto

Source baseline: `3ed45a4`. These are live account changes and public-site checks, not local fixtures. All raw run IDs below are UTC. No upgrades or purchases were made.

## Wix CSP: new case

URL: https://sadiqkarjikar10.wixsite.com/sadiq-install-lab

Dashboard → Settings → Custom Code → WebAbility lab baseline → menu → Edit Settings. Head, All pages, Essential. The original control was the dashboard script alone and returned present.

Deliberate broken configuration, saved with Apply:

```html
<meta http-equiv="Content-Security-Policy" content="script-src 'self'">
<script src="https://widget.webability.io/widget.min.js" defer></script>
```

The saved editor was reopened and independently checked. The tool returned blocked with the widget URL, `script-src-elem`, and `script-src 'self'`. This is a browser-enforced meta policy, not a response header. It may block other later scripts too; it is a disposable lab configuration, not a general Wix policy recommendation.

Repair: add only `https://widget.webability.io` to the policy's source list and Apply. The tool then returned present with HTTP 200. The policy remains installed with that narrow allowance. Reset by removing that origin from this lab policy, Apply, and verify blocked before a demonstration. Restore the allowance afterward.

| Run | ID | Result |
|---|---|---|
| Control | 2026-11-25T21-31-12-031Z-check-101f1f12 | present |
| Broken | 2026-11-26T05-25-15-220Z-check-9a8e47bf | blocked |
| Repaired | 2026-11-26T05-25-42-661Z-check-71a1bc15 | present |

Manual state/cause scores: right/right. Owner wording remains untested.

## Framer consent: repeated on current detector

URL: https://jubilant-organization-752879.framer.app/

The saved real Cookiebot snippet was changed to the `text/plain`, `data-cookieconsent="preferences"` configuration in [the reset runbook](framer-ground-truth.md). Save then Publish → Update completed. The first editor replacement accidentally retained the direct embed; this was spotted in the saved editor, corrected, and republished before any scored blocked run. Do not treat the intermediate deployment as a valid consent case.

Control `2026-11-25T21-32-18-614Z-check-a6b823d0` returned present. Fresh check `2026-11-26T05-23-21-492Z-check-e26cf25a` returned blocked with consent evidence. State/cause scores right/right.

Chrome initially had an existing Preferences grant, so it was not represented as a fresh visitor. Using the real Cookiebot widget, consent was withdrawn and the page reloaded. Change your consent opened a banner with Preferences off. The widget script was `text/plain`; after enabling Preferences and Allow selection, its type became `text/javascript`. This is manual DOM evidence of release, not an HTTP-success capture or a consent-aware MCP repair result. No cookies or participant identities are included here.

Cookiebot still showed its default Premium Trial (eight days remaining on November 25). Permanent Free transition remains unverified. No payment details or upgrade were added.

## Framer GTM: saved tag absent from live version

Framer now contains only the standard GTM bootstrap for `GTM-PJH29G6Z` (including the `gtm.start` timestamp and `gtm.js` event). No direct widget or Cookiebot embed is in this deployment. GTM version 2 contains WebAbility install lab with the All Pages trigger; its control returned present.

Published existing version 1 (Empty Container) through Versions → row menu → Publish. The dashboard showed Empty Container is Live, zero tags; the workspace still contained WebAbility install lab. This repeats the visible failure condition by rolling back the live version. It is **not** a claim that this tag has never previously been published; the original November 19 case provides that history.

The immediate check still saw present; a later fresh check saw not_installed. Both are retained. Deployment propagation/cache is a plausible explanation for the difference, not independently proven. We score the transitional run unknown for configuration alignment, not as a detector miss.

Restored version 2 through the version menu and confirmed Version 2 is Live. The repair check returned present with HTTP 200.

| Run | ID | Result |
|---|---|---|
| Control | 2026-11-26T05-26-42-990Z-check-9cf5ba08 | present |
| Immediate transition | 2026-11-26T05-27-32-160Z-check-02f301ef | present; exclude from stable broken-state score |
| Stable broken rerun | 2026-11-26T05-27-48-351Z-check-6a243be3 | not_installed |
| Repaired | 2026-11-26T05-28-23-843Z-check-f43eeaae | present |

Stable broken-state/cause scores: right/unknown. Public absence does not reveal unpublished dashboard state.

## Remaining limits

Shopify admin/theme editing is accessible, but the public store remains password-gated in existing checks. No gate bypass or paid plan is claimed. Additional owner-guidance trials, recordings and the six-case demo remain unfinished. Four accounts do not establish four-builder failure coverage.

## GTM timing methodology correction

Initial November 26 run `2026-11-26T23-26-21-327Z-gtm-f418d0dd` completed ten loads. Its first warm sample recorded a widget request at 2.46 ms but DOM insertion at 44.5 ms. Although time origins differ, this raises possible event overlap from the unscored priming navigation because the same page was reused. The initial warm series is retained but excluded from final timing conclusions.

The runner now closes the priming page and uses a new page for each warm sample in the same primed browser context. Cache/cookies remain shared while page event listeners cannot capture previous-page requests. This changes only the lab measurement runner, not check_install. A complete rerun is required rather than silently replacing samples.


Corrected ten-load run `2026-11-26T23-32-04-348Z-gtm-4e0c76f0`: fresh request median 283.73 ms, maximum 311.27 ms; warm median 103.09 ms, maximum 110.63 ms. All 10 observed; none exceeded 10 seconds. Each sample observed for 30 seconds. These are navigation-to-widget-request timings, not total check_install duration or a guarantee for other GTM configurations.

## Framer unpublished-change rerun

Published a comment-only custom-code entry, then restored the working GTM bootstrap and clicked Save without Publish. The public check returned not_installed (`2026-11-26T23-45-59-354Z-check-d9a0d753`, 2755.66 ms including MCP startup). Clicked Publish → Update; Framer confirmed the website was updated. Repair returned present with HTTP 200 (`2026-11-26T23-46-20-394Z-check-750e276a`, 2594.56 ms including startup). Scores: state right, cause unknown; a public inspection cannot prove unpublished editor state. This is an unpublished-change equivalent, not a Shopify draft theme. Reset by publishing the comment-only entry and saving the bootstrap without publishing again. Final deployment is the working GTM-only bootstrap, version 2.


## Consent repair verified in Chrome (November 26, approximately 23:49 UTC)

Published the real Cookiebot + preferences-gated widget snippet shown above. Withdrew existing consent and reloaded. Opened Chrome DevTools Network and filtered `widget.webability.io`: the visible counter was `0 / 458 requests`. Opened cookie settings → Change your consent, enabled only Preferences, and clicked Allow selection. The same Network panel then showed:

```text
https://widget.webability.io/widget.min.js                         200 OK
https://widget.webability.io/v/2026-11-24/widget-bootstrap.e4b395fe.widget.min.js  200 OK
2 / 468 requests
```

This is a manually transcribed excerpt of browser accessibility output, not an exported HAR or a check_install result. DOM inspection also showed the widget script changed to `text/javascript`. No policy/category change or bypass was used. The real banner granted permission.

A separate fresh MCP invocation `2026-11-26T23-50-01-551Z-check-82feb5c9` still correctly returned blocked/consent (3012.67 ms including startup), since it has no access to Chrome's consent. Do not claim an MCP post-consent success: the URL-only tool starts its own browser context.

Final Framer deployment is now Cookiebot + preferences-gated widget, replacing the earlier GTM-only deployment. GTM version 2 remains published but is not embedded in this final deployment; restore the recorded bootstrap before repeating GTM timing or draft tests.

Cookiebot's Manage subscription UI showed Premium Lite (€7/month), Next and a skip-trial checkbox, with no Free option. Returned to dashboard without continuing. Seven trial days remain as observed November 26; permanent Free status remains unverified.
