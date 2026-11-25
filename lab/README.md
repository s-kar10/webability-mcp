# Install failure lab

This package supports the real-builder and owner-guidance work linked to [PR #4](https://github.com/snayyar00/webability-mcp/pull/4).
It does not change the detection implementation. Latest revalidation incorporates Sid’s detector fixes through 74b254c; older evidence retains its original source commit.

## Start here

- [Case matrix](cases/matrix.md) and [machine-readable scores](cases/matrix.json)
- [Failure/scoring protocol](cases/protocol.md)
- [Technical owner-wording drafts](owner-guidance.md)
- [Account access checklist](setup.md)
- Actual hours: user will maintain the Riipen work log
- Personal handoffs, participant records, recording scripts and update drafts are delivered privately outside Git.
- [Local WordPress runbook](wordpress/README.md)

## Capture evidence

Run from the repository root using its installed dependencies:

```sh
node lab/scripts/verify-evidence.mjs
node lab/scripts/baseline.mjs
node lab/scripts/smoke.mjs
node lab/scripts/check.mjs WP-CSP-01 WordPress http://127.0.0.1:8099/
node lab/scripts/gtm-timing.mjs WP-GTM-01 WordPress https://YOUR-LAB-SITE GTM-XXXX VERSION TRIGGER INITIAL-CONSENT-STATE
```

Every run creates a unique directory in `lab/private/`, ignored by git. It contains raw response/stderr and metadata with source commit, command, timestamps and elapsed times. check.mjs returns exit 1 on an MCP tool error but still preserves the response. No automatic state/score assignment occurs.
GTM runs take approximately five minutes plus startup/priming. They require a real published container and site; do not run against invented URLs and call it GTM evidence.

After reviewing for private data, copy selected evidence into `lab/evidence/`. Preserve original private files. Never copy account credentials, cookies, authorization headers or participant identities. Record any redactions in a manifest rather than silently editing raw data. JSON and `.txt` logs are used because the repository ignores `*.log`.
Baseline proof is explicitly repository/unit/browser-fixture evidence, not real builder testing.

## Implementation boundary

The GTM runner completed ten real Framer/GTM loads on November 19. Its warm group reuses a primed browser context; it does not claim every response is a cache hit. See findings.md and the evidence manifest.

[Framer reset instructions](cases/framer-ground-truth.md) cover the three additional cases.
