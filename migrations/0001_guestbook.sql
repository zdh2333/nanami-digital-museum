CREATE TABLE guestbook_entries (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  message TEXT NOT NULL,
  entry_emoji TEXT,
  photo_key TEXT,
  photo_status TEXT NOT NULL DEFAULT 'none' CHECK (photo_status IN ('none', 'pending', 'approved', 'rejected')),
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  created_at INTEGER NOT NULL
);

CREATE INDEX guestbook_entries_public_cursor
  ON guestbook_entries(hidden, created_at DESC, id DESC);

CREATE TABLE guestbook_reactions (
  entry_id TEXT NOT NULL REFERENCES guestbook_entries(id) ON DELETE CASCADE,
  visitor_hash TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (entry_id, visitor_hash, emoji)
);

CREATE TABLE guestbook_rate_events (
  fingerprint_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('entry', 'reaction')),
  created_at INTEGER NOT NULL
);

CREATE INDEX guestbook_rate_events_window
  ON guestbook_rate_events(fingerprint_hash, action, created_at);
