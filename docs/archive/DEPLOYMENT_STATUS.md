# 洗頭店排班系統部署狀態（歷史快照）

> 存檔日期：2026-03-22。內容為當時狀態；環境變數請以 **Vercel／本機 `.env.local`** 為準，勿將金鑰貼入版本庫。

## 完成項目 ✅

### 1. GitHub Repository

- **Repository**: https://github.com/ryderyao/hair-salon-scheduler
- **狀態**: ✅ 已建立
- **描述**: 洗頭店排班系統 - Next.js + Supabase
- **可見性**: Public
- **主要分支**: main

### 2. 程式碼推送

- **狀態**: ✅ 已完成
- **說明**: 完整 Next.js 應用、Supabase 設定與資料庫腳本、README 等。

### 3. Vercel 部署準備

- **狀態**: ⏳ 需於 Vercel 以 GitHub 授權完成連結（無法以單一 Token 全自動代辦）。

## 待完成項目（當時）⏳

### Vercel 部署（手動）

1. 登入 https://vercel.com/login（建議 GitHub）
2. https://vercel.com/new → Import `ryderyao/hair-salon-scheduler`
3. 於 **Environment Variables** 設定：
   - `NEXT_PUBLIC_SUPABASE_URL` — 見 Supabase Dashboard → Project Settings → API
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — 同上（**anon / public** 金鑰）
4. Framework Preset：**Next.js** → Deploy
5. 之後 **push 至 `main`** 會觸發自動部署

## 環境變數（請勿在此檔填真值）

| 變數名稱 | 說明 |
|---------|------|
| NEXT_PUBLIC_SUPABASE_URL | Supabase 專案 URL |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | 公開 anon key（仍勿公開張貼於公開網頁以外之場合） |

## 快速連結

- GitHub: https://github.com/ryderyao/hair-salon-scheduler
- Vercel Dashboard: https://vercel.com/dashboard

---

*本檔由原根目錄快照移入 `docs/archive/`，已移除具體金鑰與 URL 範例。*
