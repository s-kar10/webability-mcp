# Local self-hosted WordPress

This is a real WordPress/MariaDB installation, bound only to `http://127.0.0.1:8099/`. It is not exposed publicly and is not a substitute for Shopify/Wix/Framer or a real Cookiebot account.
The MU plugin installs the actual dashboard embed `https://widget.webability.io/widget.min.js` without a crossorigin attribute. Script presence does not prove licensing or activation on localhost.

## Setup

Docker Desktop must be running. `.env` contains random local database credentials and is ignored by git. For a fresh checkout, create `.env` first:

```sh
node --input-type=module -e "import{writeFileSync}from'node:fs';import{randomBytes}from'node:crypto';writeFileSync('lab/wordpress/.env','DB_PASSWORD='+randomBytes(24).toString('hex')+'\\nDB_ROOT_PASSWORD='+randomBytes(24).toString('hex')+'\\n',{mode:384,flag:'wx'})"
docker compose -f lab/wordpress/compose.yaml up -d
node lab/wordpress/setup.mjs
```

Wait for the database to become ready if setup initially fails, then rerun; existing credentials are preserved. Local admin credentials are in `lab/private/wordpress-admin.json`. Never publish that file.

## Reset, run, repair

```sh
node lab/wordpress/scenario.mjs healthy
node lab/scripts/check.mjs WP-CONTROL-01 WordPress http://127.0.0.1:8099/
node lab/wordpress/scenario.mjs csp
node lab/scripts/check.mjs WP-CSP-01 WordPress http://127.0.0.1:8099/
node lab/wordpress/scenario.mjs healthy
node lab/scripts/check.mjs WP-CSP-01-REPAIRED WordPress http://127.0.0.1:8099/
```

Other scenario names: `wrong-slot`, `cached`. Each change preserves exact option commands, page HTML and response headers in a new private evidence directory.

- **healthy:** WordPress's `wp_head` emits the script. Real external CDN requests are allowed.
- **wrong-slot:** the snippet is escaped into visible `<pre>` content in the footer rather than executed as a script. This specifically models pasting code into content that displays it as text.
- **csp:** sends an actual `Content-Security-Policy: script-src 'self'` response header that blocks the external embed.
- **cached:** primes a real full-page cache while installation is absent, then enables the install option without clearing the cached response. The served HTML remains old and `X-Install-Lab-Cache: HIT` documents it. This is a minimal lab cache, not a claim about a third-party caching product.
- **healthy again:** disables/purges only the named lab cache and restores the head embed. This is the repair and reset path for all three cases.

Consent and GTM remain pending real accounts; draft-theme behavior remains planned. Do not use these CLI repair commands as non-technical usability answers. A safe owner-facing settings workflow still needs preparation and human testing.

Stop without deleting data:

```sh
docker compose -f lab/wordpress/compose.yaml stop
```

The site/database are named Docker volumes. Do not run `down -v` unless intentionally discarding the lab. Images are official WordPress and MariaDB images; record pulled digests in evidence for reproducibility.
