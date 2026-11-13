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
