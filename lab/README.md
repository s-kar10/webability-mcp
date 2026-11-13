# Install failure lab: November 13–20

This package supports the real-builder and owner-guidance work linked to [PR #4](https://github.com/snayyar00/webability-mcp/pull/4).
It does not change the detection implementation. Baseline: maintainer-reviewed branch including 991c6ed.

## Start here

- [Case matrix](cases/matrix.md) and [machine-readable scores](cases/matrix.json)
- [Failure/scoring protocol](cases/protocol.md)
- [Owner wording and participant protocol](owner-guidance.md)
- [Account access checklist](setup.md)
- [Actual hours record](work-log.json)
- [November 13 update](updates/2026-11-13.md)
- [November 20 checklist](updates/2026-11-20.md)
- [Local WordPress runbook](wordpress/README.md)

## Capture evidence

Run from the repository root using its installed dependencies:

```sh
node lab/scripts/verify-evidence.mjs
node lab/scripts/baseline.mjs
node lab/scripts/check.mjs WP-CSP-01 WordPress http://127.0.0.1:8099/
node lab/scripts/gtm-timing.mjs WP-GTM-01 WordPress https://YOUR-LAB-SITE GTM-XXXX VERSION TRIGGER INITIAL-CONSENT-STATE
```

Every run creates a unique directory in `lab/private/`, ignored by git. It contains raw response/stderr and metadata with source commit, command, timestamps and elapsed times. check.mjs returns exit 1 on an MCP tool error but still preserves the response. No automatic state/score assignment occurs.
GTM runs take approximately five minutes plus startup/priming. They require a real published container and site; do not run against invented URLs and call it GTM evidence.

After reviewing for private data, copy selected evidence into `lab/evidence/`. Preserve original private files. Never copy account credentials, cookies, authorization headers or participant identities. Record any redactions in a manifest rather than silently editing raw data. JSON and `.txt` logs are used because the repository ignores `*.log`.
Baseline proof is explicitly repository/unit/browser-fixture evidence, not real builder testing.

## Schedule (maximum planned 9.5 hours)

| When | Budget | Deliverable |
|---|---:|---|
| Nov 13 | 1h | Baseline, hours reconciliation, matrix, update |
| Nov 14–16 | 2h | Four real accounts/sites, Cookiebot and healthy controls; recruit testers |
| Nov 16–17 | 2h | Broken installs, raw responses, manual scores, GTM timing |
| Nov 18 | 1.5h | First owner-guidance round and rewrites |
| Nov 19 | 1.5h | Retest, repairs and six resettable demo cases |
| Nov 20 | 1.5h | Recordings, 10-minute demo and evidence-linked update |

If free-plan access prevents a case, document and escalate rather than buying an upgrade or counting a mock as a builder. This budget is a constraint, not a completeness promise.
Only the user can supply actual worked hours, recruit participants and finish account signups. No participant outcome or account creation is claimed without evidence.

## Implementation boundary

The GTM runner is syntax-checked but has not been validated on a real container because no GTM account exists yet. Its warm group reuses a primed browser context; it does not claim every response is a cache hit.
