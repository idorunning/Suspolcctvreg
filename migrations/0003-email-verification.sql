ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
CREATE TABLE email_challenges (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), code_hash TEXT NOT NULL, expires INTEGER NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL);
CREATE INDEX email_challenges_user ON email_challenges(user_id);
DELETE FROM sessions;
