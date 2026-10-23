-- Additive only: existing OAuth tables and records are untouched.
CREATE TABLE IF NOT EXISTS exam2_update_receipts (
  receipt_id INTEGER PRIMARY KEY AUTOINCREMENT,
  installation_id TEXT NOT NULL,
  form_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  title TEXT NOT NULL,
  device_label TEXT NOT NULL,
  account_id TEXT,
  account_email TEXT,
  installed_at TEXT NOT NULL,
  received_at TEXT NOT NULL,
  UNIQUE(installation_id, form_id, revision)
);
CREATE INDEX IF NOT EXISTS exam2_receipts_form ON exam2_update_receipts(form_id, revision, receipt_id);
CREATE TABLE IF NOT EXISTS exam2_admin_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE TABLE IF NOT EXISTS exam2_admin_attempts (
  attempt_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);
