--  migrations: 員工時薪 + 自訂時段排班
-- 執行方式：Supabase SQL Editor 貼上執行

-- 1. 員工表新增時薪欄位 (200-250)
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS hourly_rate INTEGER DEFAULT 200 
CHECK (hourly_rate >= 200 AND hourly_rate <= 250);

-- 已有資料補齊預設值
UPDATE employees SET hourly_rate = 200 WHERE hourly_rate IS NULL;

-- 2. 班表表新增自訂時段欄位
ALTER TABLE schedules 
ADD COLUMN IF NOT EXISTS start_time TEXT,
ADD COLUMN IF NOT EXISTS end_time TEXT,
ADD COLUMN IF NOT EXISTS hours NUMERIC;

-- 3. 擴充 shift_type 支援 'custom'
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_shift_type_check;
ALTER TABLE schedules ADD CONSTRAINT schedules_shift_type_check 
  CHECK (shift_type IN ('morning', 'evening', 'full', 'custom'));

-- 4. 既有資料補齊 start_time, end_time, hours（依 shift_type）
UPDATE schedules SET 
  start_time = CASE shift_type
    WHEN 'morning' THEN '12:00'
    WHEN 'evening' THEN '19:00'
    WHEN 'full' THEN '11:30'
    ELSE start_time
  END,
  end_time = CASE shift_type
    WHEN 'morning' THEN '17:00'
    WHEN 'evening' THEN '23:00'
    WHEN 'full' THEN '23:30'
    ELSE end_time
  END,
  hours = CASE shift_type
    WHEN 'morning' THEN 5
    WHEN 'evening' THEN 4
    WHEN 'full' THEN 12
    ELSE hours
  END
WHERE start_time IS NULL OR end_time IS NULL OR hours IS NULL;

-- 5. 移除舊的 unique constraint（允許多個自訂時段）
ALTER TABLE schedules DROP CONSTRAINT IF EXISTS schedules_employee_id_work_date_shift_type_key;

-- 6. 新增 composite unique（避免同員工同日期同時段重複）
CREATE UNIQUE INDEX IF NOT EXISTS idx_schedules_unique_shift 
ON schedules(employee_id, work_date, shift_type, COALESCE(start_time,''), COALESCE(end_time,''));
