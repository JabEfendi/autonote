ALTER TABLE daily_cash_transactions ADD COLUMN IF NOT EXISTS settlement_kind VARCHAR(20) CHECK (settlement_kind IN ('contract', 'collection'));
ALTER TABLE daily_cash_transactions ADD COLUMN IF NOT EXISTS borongan_amount NUMERIC(15,2) NOT NULL DEFAULT 0;
