# Owner guidance — v1, untested drafts

These are manually authored candidate answers, NOT text currently returned by check_install.
These technical drafts are separate from personal participant records, which are kept outside the repository. Do not infer hidden dashboard state from an absent script.

| Failure | One sentence | One next step |
|---|---|---|
| Wrong slot | The accessibility script is not loading on this published page. | Check that the install code is in the builder's site-wide custom-code area, then publish. |
| CSP | Your website's security policy blocked the accessibility script. | In your site's security-policy settings, allow the exact script address shown in the evidence, then check again. |
| Consent | Your consent settings are holding the accessibility script until permission is given. | Check the script's consent category against your intended policy, then test after granting that category. |
| Unpublished GTM | The script was not observed on the live page; an unpublished tag is one possible cause. | In Tag Manager, check whether the version containing the tag has been published. |
| Draft theme | The script was not observed on the published page. | Check whether you added the code to the live theme rather than an unpublished draft. |
| Old cached page | The page served to this check did not contain the script. | Clear this site's page cache, then check the published page again. |

Do not broaden CSP to wildcard/unsafe-inline or reclassify consent categories just to force a pass.
A person unable to locate a setting is a wording failure to record, not a reason to coach mid-attempt.

## Builder-specific variants

- Shopify: verify exact live-theme/custom-code navigation in the user's dev account before filling in steps. Draft theme is a native scenario; compare live URL versus explicitly identified preview.
- Wix: verify eligibility for custom code first. HTML embeds can be iframes; iframe placement must be labelled and not treated as a successful site-wide install. Do not provide paid-feature navigation as if available on a free account.
- WordPress: the local lab deliberately uses a named MU plugin for installation and a minimal full-page cache. The corresponding owner setting is lab-specific, not a claim about all WordPress sites. For usability, prepare visible safe controls or a real relevant plugin workflow before testing; CLI commands are not a non-technical repair path.
- Framer unpublished change: “The script was not observed on the published page.” Next step: “In Framer, check Settings → Code for the saved install code, then use Publish → Update to put it on the live site.” This path was exercised, but the wording remains untested by participants.
- Framer/GTM: “The script was not observed on the live page; an unpublished tag is one possible cause.” Next step: “In Tag Manager, check that the live version contains WebAbility install lab; if your intended tag is only in the workspace, use Submit → Publish, then check the page again.”
- Framer/Cookiebot: “The script is waiting for Preferences consent on this page.” Next step: “On the site’s cookie banner, enable Preferences and choose Allow selection to test the permitted state; verify that this category matches your intended policy.” Do not present intended consent withholding as an installation mistake.

## Wix CSP — v2 candidate, November 26

Sentence: “Your website's security policy blocked the WebAbility script.”

Next step for this specific lab: “In Wix, open Settings → Custom Code, use the menu beside WebAbility lab baseline → Edit Settings, and add `https://widget.webability.io` after `'self'` in the `script-src` line; click Apply, then check the page again.”

This path and narrow policy repair were exercised on the real free account. It is untested wording, not a claim that a non-technical owner can safely edit an arbitrary production policy. Do not remove the policy or broaden it to a wildcard.
