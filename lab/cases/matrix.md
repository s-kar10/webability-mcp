# Case matrix — November 24

Six failures historically reproduced across WordPress and Framer; six Shopify cells access-blocked and twelve cells planned. Wix has a verified healthy control. Scores reflect manual evidence review, not participant success. Framer draft is an unpublished-change equivalent. Consent repair is a lab rollback.

| Case | Builder | Failure | Status | State | Explanation |
|---|---|---|---|---|---|
| SHOP-SLOT-01 | Shopify | Wrong code slot | access-blocked | — | — |
| SHOP-CSP-01 | Shopify | Enforced Content-Security-Policy | access-blocked | — | — |
| SHOP-CONSENT-01 | Shopify | Real Cookiebot consent block | access-blocked | — | — |
| SHOP-GTM-01 | Shopify | Unpublished GTM tag | access-blocked | — | — |
| SHOP-DRAFT-01 | Shopify | Draft theme or unpublished equivalent | access-blocked | — | — |
| SHOP-CACHE-01 | Shopify | Old cached page | access-blocked | — | — |
| WIX-SLOT-01 | Wix | Wrong code slot | planned | — | — |
| WIX-CSP-01 | Wix | Enforced Content-Security-Policy | planned | — | — |
| WIX-CONSENT-01 | Wix | Real Cookiebot consent block | planned | — | — |
| WIX-GTM-01 | Wix | Unpublished GTM tag | planned | — | — |
| WIX-DRAFT-01 | Wix | Draft theme or unpublished equivalent | planned | — | — |
| WIX-CACHE-01 | Wix | Old cached page | planned | — | — |
| WP-SLOT-01 | WordPress | Wrong code slot | reproduced | right | unknown |
| WP-CSP-01 | WordPress | Enforced Content-Security-Policy | reproduced | right | right |
| WP-CONSENT-01 | WordPress | Real Cookiebot consent block | planned | — | — |
| WP-GTM-01 | WordPress | Unpublished GTM tag | planned | — | — |
| WP-DRAFT-01 | WordPress | Draft theme or unpublished equivalent | planned | — | — |
| WP-CACHE-01 | WordPress | Old cached page | reproduced | right | unknown |
| FRAMER-SLOT-01 | Framer | Wrong code slot | planned | — | — |
| FRAMER-CSP-01 | Framer | Enforced Content-Security-Policy | planned | — | — |
| FRAMER-CONSENT-01 | Framer | Real Cookiebot consent block | reproduced | right | right |
| FRAMER-GTM-01 | Framer | Unpublished GTM tag | reproduced | right | unknown |
| FRAMER-DRAFT-01 | Framer | Draft theme or unpublished equivalent | reproduced | right | unknown |
| FRAMER-CACHE-01 | Framer | Old cached page | planned | — | — |

[Full run references and scoring reasons](matrix.json). [Framer ground truth and reset instructions](framer-ground-truth.md).

November 24 revalidation: the three WordPress cases have new control/broken/repair runs on Sid’s latest fixes. Wix and Framer public controls pass, but the three Framer broken-case reruns remain pending dashboard access. Original evidence is retained.
