-- 每日交接班（清潔勾選、結帳聲明、特別狀況）
-- 每日最多兩筆：早班 / 晚班（同一日同班別唯一）
-- 於 Supabase SQL Editor 執行（需已存在 employees 與 update_updated_at_column，見 schema.sql）

CREATE TABLE IF NOT EXISTS handover_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_date DATE NOT NULL,
  shift_slot TEXT NOT NULL CHECK (shift_slot IN ('morning', 'evening')),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  created_by_admin BOOLEAN NOT NULL DEFAULT false,
  clean_service_area BOOLEAN NOT NULL DEFAULT false,
  clean_smart_unit BOOLEAN NOT NULL DEFAULT false,
  clean_styling_seating BOOLEAN NOT NULL DEFAULT false,
  clean_trash_restroom BOOLEAN NOT NULL DEFAULT false,
  clean_consumables_tools BOOLEAN NOT NULL DEFAULT false,
  clean_water_light_audio BOOLEAN NOT NULL DEFAULT false,
  clean_evening_close BOOLEAN NOT NULL DEFAULT false,
  cash_reconciled BOOLEAN NOT NULL DEFAULT false,
  cash_notes TEXT,
  special_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT handover_one_per_day_slot UNIQUE (work_date, shift_slot)
);

CREATE INDEX IF NOT EXISTS idx_handover_work_date ON handover_records(work_date DESC);

DROP TRIGGER IF EXISTS update_handover_records_updated_at ON handover_records;
CREATE TRIGGER update_handover_records_updated_at
  BEFORE UPDATE ON handover_records
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE handover_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users to read handover_records"
  ON handover_records FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to insert handover_records"
  ON handover_records FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Allow authenticated users to update handover_records"
  ON handover_records FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Allow authenticated users to delete handover_records"
  ON handover_records FOR DELETE TO authenticated USING (true);
