# Case matrix — November 26

Seven distinct failures reproduced across WordPress, Framer and Wix. Six Shopify cells remain access-blocked; eleven cells remain planned. Results span dated runs; see the revalidation notes for current versus historical evidence. Scores are evidence review, not participant success.

| Case | Builder | Failure | Status | State | Explanation |
|---|---|---|---|---|---|
| SHOP-SLOT-01 | Shopify | Wrong code slot | access-blocked | — | — |
| SHOP-CSP-01 | Shopify | Enforced Content-Security-Policy | access-blocked | — | — |
| SHOP-CONSENT-01 | Shopify | Real Cookiebot consent block | access-blocked | — | — |
| SHOP-GTM-01 | Shopify | Unpublished GTM tag | access-blocked | — | — |
| SHOP-DRAFT-01 | Shopify | Draft theme or unpublished equivalent | access-blocked | — | — |
| SHOP-CACHE-01 | Shopify | Old cached page | access-blocked | — | — |
| WIX-SLOT-01 | Wix | Wrong code slot | planned | — | — |
| WIX-CSP-01 | Wix | Enforced Content-Security-Policy | reproduced | right | right |
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

[Run references](matrix.json). [November 26 revalidation and reset steps](revalidation-2026-11-26.md).
Framer consent and GTM were repeated. GTM rerun models a saved tag absent from the live version, not a second never-published tag. Draft-change rerun also completed: saved-but-unpublished code returned not_installed, publishing restored present/HTTP 200.
