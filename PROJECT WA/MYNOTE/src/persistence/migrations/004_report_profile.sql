CREATE TABLE IF NOT EXISTS report_profiles (
  name TEXT PRIMARY KEY,
  company_name TEXT NOT NULL DEFAULT 'PT. Abdi Tasumu Indo',
  report_name TEXT NOT NULL DEFAULT 'Laporan Keuangan Garasi Lampung',
  total_units INTEGER NOT NULL DEFAULT 10,
  opening_balance NUMERIC(15,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO report_profiles (name) VALUES ('default') ON CONFLICT (name) DO NOTHING;
