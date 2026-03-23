# 專案合併說明

## 已完成

- **hair-salon-scheduler-new** 已刪除
- 以 **hair-salon-scheduler** 為唯一專案

## 線上網站

- **網址**: https://hair-salon-scheduler-silk.vercel.app
- **Vercel 專案**: hair-salon-scheduler

## 已修正問題

1. **錯誤訊息不明**：新增排班失敗時現在會顯示 Supabase 的錯誤內容
2. **無員工提示**：無在職員工時會顯示「請先到員工管理新增員工」
3. **載入狀態**：按下「新增」會顯示「新增中...」避免重複點擊

## 建議做法

**hair-salon-scheduler** 已合併為唯一專案，hair-salon-scheduler-new 已移除。

請確認 Vercel 部署來源為本專案，且 Supabase 使用 `schedules` 表（執行 `supabase/schema.sql`）。

## 部署檢查清單

- [ ] Vercel 環境變數：`NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Supabase 已建立資料表（執行 `supabase/schema.sql` 建立 `schedules`）
- [ ] 已建立認證用戶並可成功登入
- [ ] 已在員工管理新增至少一位在職員工

---
*建立於 2026-03-23*
