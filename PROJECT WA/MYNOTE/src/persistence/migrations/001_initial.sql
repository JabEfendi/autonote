CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  source_message_id TEXT NOT NULL UNIQUE,
  group_id TEXT NOT NULL,
  group_name TEXT NOT NULL,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  message_text TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,
  processing_status TEXT NOT NULL,
  processing_error TEXT
);

CREATE TABLE IF NOT EXISTS records (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL UNIQUE REFERENCES messages(id),
  transaction_date DATE NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('pemasukan', 'pengeluaran')),
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount_minor BIGINT NOT NULL CHECK(amount_minor > 0),
  currency TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  action TEXT NOT NULL,
  source_message_id TEXT,
  status TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS allowed_groups (
  group_id TEXT PRIMARY KEY,
  group_name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS command_formats (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  command TEXT NOT NULL UNIQUE,
  target_command TEXT NOT NULL DEFAULT '#catat',
  description TEXT NOT NULL,
  template TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  built_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS daily_cash_transactions (
  id BIGSERIAL PRIMARY KEY,
  transaction_date DATE NOT NULL,
  description VARCHAR(500) NOT NULL,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense', 'transfer')),
  category TEXT NOT NULL,
  subcategory TEXT,
  income_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  expense_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
  vehicle_plate TEXT,
  quantity NUMERIC(15,3),
  unit TEXT,
  route_origin TEXT,
  route_destination TEXT,
  counterparty VARCHAR(150),
  reference_number VARCHAR(100),
  installment_number INTEGER,
  source_message_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'posted' CHECK (status IN ('pending', 'posted', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (income_amount >= 0 AND expense_amount >= 0 AND NOT (income_amount > 0 AND expense_amount > 0))
);

CREATE TABLE IF NOT EXISTS daily_cash_reports (
  id BIGSERIAL PRIMARY KEY,
  report_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  total_units INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  UNIQUE (report_name, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS daily_cash_transactions_date_idx ON daily_cash_transactions(transaction_date, id);
CREATE INDEX IF NOT EXISTS daily_cash_transactions_vehicle_idx ON daily_cash_transactions(vehicle_plate);
CREATE UNIQUE INDEX IF NOT EXISTS daily_cash_transactions_source_message_idx ON daily_cash_transactions(source_message_id) WHERE source_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS records_transaction_date_idx ON records(transaction_date);
CREATE INDEX IF NOT EXISTS messages_group_id_idx ON messages(group_id);
