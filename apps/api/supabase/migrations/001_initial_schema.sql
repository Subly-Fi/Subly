-- Subly initial database schema
-- Run this in the Supabase SQL editor or via supabase db push

-- Merchant profiles
CREATE TABLE IF NOT EXISTS merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet TEXT UNIQUE NOT NULL,
  name TEXT,
  email TEXT,
  webhook_url TEXT,
  api_key TEXT UNIQUE DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_merchants_wallet ON merchants(wallet);
CREATE INDEX idx_merchants_api_key ON merchants(api_key);

-- Plans (on-chain data mirror)
CREATE TABLE IF NOT EXISTS plans (
  address TEXT PRIMARY KEY,
  merchant_wallet TEXT REFERENCES merchants(wallet) ON DELETE CASCADE,
  mint TEXT NOT NULL,
  amount BIGINT NOT NULL,
  period_hours INT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'sunset', 'expired', 'deleted')),
  metadata_uri TEXT,
  plan_id BIGINT,
  on_chain_status TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_plans_merchant ON plans(merchant_wallet);
CREATE INDEX idx_plans_status ON plans(status);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_address TEXT REFERENCES plans(address) ON DELETE SET NULL,
  subscriber_wallet TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'payment_failed')),
  current_period_start TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  consecutive_failures INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_address, subscriber_wallet)
);

CREATE INDEX idx_subscriptions_plan ON subscriptions(plan_address);
CREATE INDEX idx_subscriptions_subscriber ON subscriptions(subscriber_wallet);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);

-- Payment history
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_address TEXT REFERENCES plans(address) ON DELETE SET NULL,
  subscriber_wallet TEXT NOT NULL,
  merchant_wallet TEXT NOT NULL,
  amount TEXT NOT NULL,
  mint TEXT NOT NULL,
  tx_signature TEXT,
  status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failed')),
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_payments_plan ON payments(plan_address);
CREATE INDEX idx_payments_merchant ON payments(merchant_wallet);
CREATE INDEX idx_payments_subscriber ON payments(subscriber_wallet);
CREATE INDEX idx_payments_created ON payments(created_at DESC);

-- Subscription events (from on-chain indexer)
CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('created', 'cancelled', 'resumed', 'transfer')),
  plan_address TEXT,
  subscriber_wallet TEXT,
  merchant_wallet TEXT,
  mint TEXT,
  amount TEXT,
  tx_signature TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_sub_events_plan ON subscription_events(plan_address);
CREATE INDEX idx_sub_events_merchant ON subscription_events(merchant_wallet);
CREATE INDEX idx_sub_events_type ON subscription_events(event_type);

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID REFERENCES merchants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_webhook_merchant ON webhook_deliveries(merchant_id);
CREATE INDEX idx_webhook_status ON webhook_deliveries(status);

-- Indexer state (tracks last processed signature per program)
CREATE TABLE IF NOT EXISTS indexer_state (
  program TEXT PRIMARY KEY,
  last_signature TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER merchants_updated_at BEFORE UPDATE ON merchants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER plans_updated_at BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Row Level Security
ALTER TABLE merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Service role has full access (API uses service role key)
CREATE POLICY "Service role full access" ON merchants FOR ALL USING (true);
CREATE POLICY "Service role full access" ON plans FOR ALL USING (true);
CREATE POLICY "Service role full access" ON subscriptions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON payments FOR ALL USING (true);
CREATE POLICY "Service role full access" ON webhook_deliveries FOR ALL USING (true);
CREATE POLICY "Service role full access" ON indexer_state FOR ALL USING (true);
