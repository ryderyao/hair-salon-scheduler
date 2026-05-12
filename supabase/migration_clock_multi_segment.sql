-- 同日多段上下班打卡：同一員工同一天可有多筆 clock_records。
-- 規則由前端遵守：須先下班才可再打下一次上班。
--
-- 若先前已執行 migration_clock_records.sql，會存在 UNIQUE (employee_id, work_date)，須先卸除。
-- 在 Supabase SQL Editor 執行本檔即可。

DROP INDEX IF EXISTS idx_clock_records_employee_date;

CREATE INDEX IF NOT EXISTS idx_clock_records_employee_work_date
  ON clock_records(employee_id, work_date);
