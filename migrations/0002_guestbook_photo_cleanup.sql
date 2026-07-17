-- Intent rows are written before an R2 pending-photo put. They allow the
-- private scheduled cleaner to recover even when an upload fails ambiguously.
CREATE TABLE guestbook_photo_cleanup (
  photo_key TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL
);

CREATE INDEX guestbook_photo_cleanup_created
  ON guestbook_photo_cleanup(created_at);
