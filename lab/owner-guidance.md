# Owner guidance — v1, untested drafts

These are manually authored candidate answers, NOT text currently returned by check_install.
No participants have tested them. Do not infer hidden dashboard state from an absent script.

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
- Framer: verify published custom-code support in the account and document actual settings before filling in steps. If unavailable, mark access-blocked.

## Participant protocol

Recruit 2–3 consenting non-technical friends/family; identify them only as P1/P2/P3 in public notes.
Use disposable lab accounts with no production data. Assign two cases per person, allowing five minutes each.
Provide only the broken page, safe lab access, and the exact answer. No hints, screen sharing help, or live coaching during the attempt.
Record completion, time, wrong turns and confusing words in participant-results.json. Verify the repair independently with check_install and configuration evidence.
Revise only after recording the first attempt; preserve v1 text, add v2 and a reason. Reset the case and retest.
Prefer a different participant; if repeated, mark prior exposure. Report successes/attempts and distinct participants, not a population success rate.
Record failures honestly. Do not fill the before/after section until real observations exist.

## Before/after results

Pending real participant sessions. Recruitment and availability are not yet confirmed.
