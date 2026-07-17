# Nanami Cat guestbook moderation

The guestbook is a living archive for Nanami. Text and a single approved emoji
are public immediately; every submitted photo stays private until the owner
reviews it in the Cloudflare Console. There is intentionally no public or
custom moderation interface.

## Review a pending photo

1. Open **Cloudflare Dashboard → Workers & Pages → D1 → nanami-guestbook →
   Console**.
2. Run the query below and inspect the entry details.
3. In **R2 → nanami-guestbook-photos**, open the object at the exact
   `photo_key` shown by D1. Before approval, visually confirm that it is a cat
   photo and contains no human face. Do not infer this from the filename or
   accept an image with an uncertain subject.
4. Only after that review, approve the exact entry ID. Approved images are
   served through the guestbook photo route; pending and rejected images never
   receive a public URL.

```sql
SELECT id, nickname, message, photo_key, created_at FROM guestbook_entries
WHERE photo_status = 'pending' ORDER BY created_at DESC;
UPDATE guestbook_entries SET photo_status = 'approved' WHERE id = 'entry-id-after-visual-review';
UPDATE guestbook_entries SET hidden = 1 WHERE id = 'entry-id-to-hide';
DELETE FROM guestbook_entries WHERE id = 'entry-id-to-delete';
```

## Reject, hide, or delete

- **Reject:** run `UPDATE guestbook_entries SET photo_status = 'rejected' WHERE id = 'entry-id';`.
  The entry can remain as text but the image cannot be public.
- **Hide:** use the exact `hidden = 1` statement above for abusive or
  unsuitable content. Hidden entries are omitted from the public API.
- **Delete:** use the exact `DELETE` statement above for permanent removal.
  Deleting an entry removes its reactions through the foreign-key relation.
- **Remove a rejected image:** first obtain the precise `photo_key` from the
  D1 row, then delete that exact object in the R2 dashboard. Never delete by a
  guessed prefix or another visitor's key. The private cleaner also removes
  abandoned pending uploads after its recovery window.

## Privacy and recovery checks

- Do not publish a pending/rejected R2 object or give it a public bucket URL.
  The bucket remains private; only the Pages Function serves approved photos.
- Re-check the message before approval. User text is plain text and must not
  be copied into HTML or converted into a link.
- To diagnose a public-photo report, set `hidden = 1` first, then review the
  D1 record and R2 object. This stops public delivery while preserving enough
  evidence for a deliberate decision.
- The Turnstile secret and guestbook HMAC key are Pages secrets. Rotate them
  in **Workers & Pages → nanami-digital-museum → Settings → Variables and
  Secrets** if access is suspected; never place either value in a repository
  file, browser source, screenshot, or support message.

## Deployment configuration

`wrangler.toml` binds the private D1 database, private R2 bucket, and the
route-less image sanitizer Service Binding. The committed
`.env.production` contains only the public Turnstile site key required by the
Vite production build. It is safe to expose; it is not the verification
secret. Its server-side hostname allowlist is deliberately exact:
`nanamicat.com`, `www.nanamicat.com`, and
`nanami-digital-museum.pages.dev`; do not add a wildcard.

For local Pages development, create an untracked `.dev.vars` from the tracked
`.dev.vars.example`. It contains only Cloudflare's test Turnstile values and a
placeholder local HMAC value. Replace only the HMAC placeholder locally; do
not copy production credentials into that file.
