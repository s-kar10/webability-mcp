# Account and access checklist

Confirmed by the user on November 13: no Shopify, Wix, Framer, Cookiebot or GTM accounts exist yet.
No purchases or paid upgrades are authorized. Do not count account creation as a completed install test.

| Service | User action | Success check / blocker |
|---|---|---|
| Shopify | Create your own developer/partner account and eligible free testing store. | Verify theme editing, live versus preview URLs, and whether the store is password-protected. The tool must not mistake a password gate for the storefront. |
| Wix | Create a free site; inspect custom-code eligibility. | Official custom code requires a published site and connected domain. If blocked, retain proof and ask Sid for eligible test access or reduced scope. An HTML iframe is not equivalent to a site-wide embed. |
| Framer | Create a free account and test site; inspect publishing and custom-code settings. | Do not assume code injection is free. Capture eligibility screen and ask Sid if unavailable. |
| Cookiebot | Create a real free account for one small lab domain. | Confirm plan eligibility, public scan reachability, domain registration and actual consent-state behavior. A localhost-only WordPress site is not automatically an eligible publicly scannable domain. |
| Google Tag Manager | Create your own account/container for an eligible lab site. | Record container ID and published version, then create an unpublished tag in the workspace. Do not publish a tag to a production site. |
| WordPress | Local Docker site is provided; use ignored local credentials. | Verify the site and real script request; this is one builder only. |
| Riipen | Sign in to the project and supply dates/durations for the reported 20 hours. | No hours have been submitted by this implementation. A cumulative total is not a dated work log. |

Passwords, signup terms and verification steps remain with the user. No accounts or subscriptions have been created on their behalf.

## Current official reference links

- [Wix custom code requirements](https://dev.wix.com/docs/overview/site-features-tools/about-custom-code)
- [Shopify dev stores](https://shopify.dev/docs/apps/build/stores/development-stores)
- [Framer custom code](https://www.framer.com/help/articles/how-to-add-custom-code/)
- [Cookiebot free plan limits](https://support.cookiebot.com/hc/en-us/articles/360006241733-Why-am-I-not-on-the-Free-subscription)

## Message for Sid

I have under 10 hours available through November 20 and am building the lab using free accounts. Wix's documented custom-code path requires a connected domain; Framer's account eligibility still needs verification. Can you provide eligible test access where free plans prevent a real install, or confirm a reduced scope for this milestone? I will label inaccessible cases rather than count simulations as builder tests. The local WordPress lab and raw-log capture are available now.
