-- Subly migration 005 — per-plan indexer cursors
--
-- The indexer now polls getSignaturesForAddress on each registered Subly plan
-- PDA (instead of the shared program), so each plan needs its own cursor. The
-- old single-row indexer_state (keyed by program) is no longer used but left in
-- place.

CREATE TABLE IF NOT EXISTS plan_index_state (
  plan_address TEXT PRIMARY KEY,
  last_signature TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE plan_index_state ENABLE ROW LEVEL SECURITY;
-- No policies: service-role only (bypasses RLS); anon/authenticated get nothing.
