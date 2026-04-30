-- 薪資加班登記（店長代員工登記；時數 × 與正班相同時薪）
-- 於 Supabase SQL Editor 執行（需已存在 employees、update_updated_at_column）

CREATE TABLE IF NOT EXISTS payroll_overtime_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  overtime_hours NUMERIC(6, 2) NOT NULL CHECK (overtime_hours > 0 AND overtime_hours <= 999),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_overtime_work_date ON payroll_overtime_entries(work_date DESC);
CREATE INDEX IF NOT EXISTS idx_payroll_overtime_employee ON payroll_overtime_entries(employee_id);

DROP TRIGGER IF EXISTS update_payroll_overtime_entries_updated_at ON payroll_overtime_entries;
CREATE TRIGGER update_payroll_overtime_entries_updated_at
  BEFORE UPDATE ON payroll_overtime_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE payroll_overtime_entries ENABLE ROW LEVEL SECURITY;

-- 可重複執行：policy 已存在時先 DROP 再 CREATE（避免 42710）
DROP POLICY IF EXISTS "Allow authenticated users to read payroll_overtime_entries"
  ON payroll_overtime_entries;
CREATE POLICY "Allow authenticated users to read payroll_overtime_entries"
  ON payroll_overtime_entries FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to insert payroll_overtime_entries"
  ON payroll_overtime_entries;
CREATE POLICY "Allow authenticated users to insert payroll_overtime_entries"
  ON payroll_overtime_entries FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated users to update payroll_overtime_entries"
  ON payroll_overtime_entries;
CREATE POLICY "Allow authenticated users to update payroll_overtime_entries"
  ON payroll_overtime_entries FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete payroll_overtime_entries"
  ON payroll_overtime_entries;
CREATE POLICY "Allow authenticated users to delete payroll_overtime_entries"
  ON payroll_overtime_entries FOR DELETE TO authenticated USING (true);
