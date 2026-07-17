# Guestbook rate-event cleaner

`nanami-guestbook-cleaner` is a route-less Cloudflare Worker that removes D1 rate events older than the shared ten-minute guestbook window. Its scheduled trigger runs every 15 minutes, so expiry does not depend on another visitor submitting a message or a reaction.

Task 7 must replace the placeholder `database_id` in `workers/nanami-guestbook-cleaner/wrangler.toml` with the ID returned by:

```bash
npx wrangler d1 create nanami-guestbook
```

After the D1 migration has been applied, deploy the worker without adding any Worker route:

```bash
npx wrangler deploy -c workers/nanami-guestbook-cleaner/wrangler.toml
```

Keep `workers_dev = false` and the `*/15 * * * *` cron trigger. The worker has no `fetch` handler, no Pages binding, and no public endpoint.
