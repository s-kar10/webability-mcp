# Framer ground truth and reset instructions

Manual browser observations from November 19–20, distinct from machine-generated evidence. Site: https://jubilant-organization-752879.framer.app/. Custom code is in Settings → Code → WebAbility lab baseline, All pages, Run Once. Save changes, then Publish → Update. Saving alone does not deploy. These are real account tests; no local replacement page or intercepted requests were used.

## Unpublished-change equivalent — November 19

1. Healthy control: direct dashboard embed loaded (HTTP 200, present).
2. Published a comment-only replacement for the embed.
3. Restored the embed in the editor and saved without publishing. Editor contained the script while public HTML did not. The tool returned not_installed.
4. Publish → Update restored present. This is a Framer unpublished-change equivalent, not a Shopify draft theme.

Raw public HTML before/after is in evidence directories ending `8cfcda9d` / `03fcd174`. Private editor screenshot was retained; it is not included in public artifacts. Reset by repeating steps 2–3. Do not count merely removing code as proof of an unpublished draft; independently inspect the saved editor version.

## Unpublished GTM — November 19

Actual container GTM-PJH29G6Z. Saved Custom HTML tag **WebAbility install lab** containing the dashboard widget embed, trigger All Pages / Page View. Live version 1 was Empty Container. Published Framer with only the container snippet below, with no direct widget embed. Public HTML (evidence ending `b94322ad`) and the workspace/live-version difference establish the cause; the tool correctly returned not_installed but cannot discover that hidden cause from absence alone.

```html
<script async src="https://www.googletagmanager.com/gtm.js?id=GTM-PJH29G6Z"></script>
<script>window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag("js", new Date());</script>
```

Published version 2, **Publish WebAbility lab baseline**. The immediate tool call still returned not_installed (`9084a123`); the later rerun returned present (`8e78e004`). Preserve both. Timing then observed requests in all ten loads. Propagation/cache is a possible explanation for the transient result, not proven causation.

Reset: restore the container-only snippet on Framer; in GTM publish an empty lab version, then restore the tag in the workspace without publishing. Verify live empty versus saved unpublished tag. Repair by publishing that tag and rerunning until deployment is independently verified. Version numbers will change; record them. Do not reuse old logs as new runs.

## Real Cookiebot — November 20

Real domain group `0cea3650-f035-41b6-b069-1c5787d9aa8d`, registered to the Framer domain. Cookiebot account displays its default 14-day Premium Trial; no paid upgrade was selected. Published:

```html
<script id="Cookiebot" src="https://consent.cookiebot.com/uc.js" data-cbid="0cea3650-f035-41b6-b069-1c5787d9aa8d" type="text/javascript"></script>
<script type="text/plain" data-cookieconsent="preferences" src="https://widget.webability.io/widget.min.js"></script>
```

The banner displayed Preferences off. Fresh tool check returned blocked with `kind: consent`, `type: text/plain`, `data-cookieconsent: preferences` (run `b96ee9cd`). Public page capture ends `24d314ee`. In Chrome, selecting Preferences and Allow selection changed the widget script type to text/javascript. This is DOM evidence of release; it is not a captured HTTP-success result after that click. No participant performed this test.

The preferences category is a deliberate lab assignment, not a claim about the widget's appropriate legal category. Consent withholding can be intended behavior. Owner guidance must ask the owner to verify their intended policy, not universally disable consent.

Control rollback: retained Cookiebot and replaced the deliberately gated widget tag with the original direct embed. A fresh-context tool call returned present (`ddc22235`). This is a rollback of the test configuration, not proof that a consent-preserving repair was validated by the tool. At the end of November 20, Framer deployed Cookiebot plus the direct widget. This is superseded by the November 26 GTM-only deployment; see [current revalidation notes](revalidation-2026-11-26.md). For a future consent test, restore the gated snippet and use a fresh browser consent state. Do not call a previously consented browser a fresh visitor.

The first November 20 publish attempt showed a network error. Reloading verified saved code, and a second Publish → Update succeeded. No failed publication was scored as a reproduced consent case.

## Scope and proof

All raw check/control/repair run IDs are in matrix.json; machine output is unchanged. These instructions make the cases resettable one at a time, not six simultaneously available URLs. For the live demo, reset each case and verify its state before recording. Script presence does not establish licensing, activation, or accessibility conformance.
