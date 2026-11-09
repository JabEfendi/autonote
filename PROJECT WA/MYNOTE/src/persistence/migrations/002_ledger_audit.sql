ALTER TABLE daily_cash_transactions ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE daily_cash_transactions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE daily_cash_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
CREATE INDEX IF NOT EXISTS daily_cash_transactions_status_date_idx ON daily_cash_transactions(status, transaction_date, created_at, id);
