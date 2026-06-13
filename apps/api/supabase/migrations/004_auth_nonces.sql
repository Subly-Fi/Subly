-- Subly migration 004 — durable auth nonces (serverless-safe)
--
-- The wallet-signature challenge/verify flow stored nonces in an in-memory Map,
-- which breaks on serverless (each invocation is a fresh instance). Persist them
-- so /auth/challenge and /auth/verify can run on different instances.

CREATE TABLE IF NOT EXISTS auth_nonces (
  wallet TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_nonces_expires ON auth_nonces(expires_at);

ALTER TABLE auth_nonces ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only (bypasses RLS); anon/authenticated get nothing.
