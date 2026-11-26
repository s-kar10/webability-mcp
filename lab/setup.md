# Account and access status — November 26

No paid plans or upgrades were purchased. User completed signup, credentials and terms handoffs. Account creation is separate from successful installation testing.

| Service | Observed status | Remaining limit |
|---|---|---|
| Shopify | Own partner account and Sadiq Install Lab development store; theme editing available. | Password gate at sadiq-install-lab.myshopify.com/password prevents URL-only storefront control. No bypass or upgrade. Shopify failure coverage remains access-blocked. |
| Wix | Own free account; published https://sadiqkarjikar10.wixsite.com/sadiq-install-lab ; site-wide Head custom code persisted and check_install returned present. | CSP failure and narrow-origin repair verified November 26. Other Wix failure cells remain pending. The earlier connected-domain assumption did not hold for this observed account. |
| Framer | Own free account; published https://jubilant-organization-752879.framer.app/ ; custom code and controls verified. | Three failures tested one at a time, not three separate persistent pages. |
| Cookiebot | Own real account; one Framer domain, actual consent banner deployed and withholding tested. Default Premium Trial, eight days remaining observed November 25. | Not yet a confirmed permanent Free subscription. Do not select Upgrade or add payment details. |
| Google Tag Manager | Own account Sadiq Install Lab; Web container GTM-PJH29G6Z. Tag published in version 2 after unpublished test. | November 26 deployment uses the standard GTM-only bootstrap; version 2 restored after an empty-live-version failure. Cookiebot consent case remains resettable, not simultaneously deployed. |
| WordPress | Local Docker WordPress/MariaDB; owner controls verified in Settings → Install lab. | Localhost only; friends should use this computer in person. Controls are lab-specific. |
| Riipen | Work log handled separately with the user. | Personal hours and communications remain outside this repository. |

Cookiebot's [official free-subscription instructions](https://support.cookiebot.com/hc/en-us/articles/360003807613-How-can-I-get-a-Free-subscription) say signup begins with a 14-day trial and eligible single small domains can choose Free after it ends. The switch disables Premium features and requires confirmation. This account has one small domain, but the eventual Free transition has not been observed. Keep it without payment details and choose Free when offered; if unavailable, stop rather than upgrade.

Final November 26 deployment: Framer uses real Cookiebot with the widget gated on Preferences. Chrome Network verified HTTP 200 after permission; fresh MCP remains blocked/consent as expected. GTM version 2 remains published but is no longer embedded until the timing bootstrap is restored. Cookiebot dashboard shows seven trial days; only paid subscription options were offered, none selected.
