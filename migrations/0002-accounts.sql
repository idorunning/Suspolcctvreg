CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, credential TEXT NOT NULL, recovery_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('user','supervisor','webmaster')), active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
ALTER TABLE sessions ADD COLUMN user_id TEXT REFERENCES users(id);
DELETE FROM sessions;
ALTER TABLE audit ADD COLUMN actor_id TEXT;
ALTER TABLE audit ADD COLUMN status INTEGER;
CREATE TABLE IF NOT EXISTS invitations (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('user','supervisor','webmaster')), created_by TEXT NOT NULL, expires INTEGER NOT NULL, used_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
