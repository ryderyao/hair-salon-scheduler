-- 收支記錄（管理者手動記帳、月加總）
-- 於 Supabase SQL Editor 執行（若專案尚未有 update_updated_at_column，需先執行 schema 或 migration_clock_records）

CREATE TABLE IF NOT EXISTS finance_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_date DATE NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('income', 'expense')),
  category_id TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_entries_entry_date ON finance_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_finance_entries_direction ON finance_entries(direction);

DROP TRIGGER IF EXISTS update_finance_entries_updated_at ON finance_entries;
CREATE TRIGGER update_finance_entries_updated_at
  BEFORE UPDATE ON finance_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE finance_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read finance_entries"
  ON finance_entries FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert finance_entries"
  ON finance_entries FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update finance_entries"
  ON finance_entries FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete finance_entries"
  ON finance_entries FOR DELETE TO authenticated USING (true);
