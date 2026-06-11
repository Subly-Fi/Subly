-- Subly migration 002 — indexer correctness + security hardening
-- Apply after 001_initial_schema.sql.

-- 1. Relax mirror-table foreign keys.
--    The off-chain tables mirror on-chain truth, which the indexer may observe
--    out of order (e.g. a Subscribe before its Plan is mirrored, or a payment
--    for a merchant that has not registered off-chain). Enforcing these FKs would
--    make the indexer reject legitimate on-chain events. On-chain is the source
--    of truth; keep the columns but drop the constraints.
ALTER TABLE plans DROP CONSTRAINT IF EXISTS plans_merchant_wallet_fkey;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_address_fkey;
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_plan_address_fkey;

-- 2. Deduplicate payments by on-chain transaction signature.
--    The cron collector and the indexer both observe the same on-chain transfer;
--    a UNIQUE(tx_signature) lets them upsert into a single row. NULL signatures
--    (failed collection attempts) are exempt — Postgres allows multiple NULLs.
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_tx_signature_unique;
ALTER TABLE payments ADD CONSTRAINT payments_tx_signature_unique UNIQUE (tx_signature);

-- 3. Close the RLS gaps from 001 (subscription_events + indexer_state had no
--    RLS enabled). Policies remain permissive USING(true) because the API uses
--    the service-role key; this keeps the schema internally consistent.
ALTER TABLE subscription_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE indexer_state ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'subscription_events' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON subscription_events FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'indexer_state' AND policyname = 'Service role full access'
  ) THEN
    CREATE POLICY "Service role full access" ON indexer_state FOR ALL USING (true);
  END IF;
END $$;
