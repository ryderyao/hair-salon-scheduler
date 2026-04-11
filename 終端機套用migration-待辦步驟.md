# 終端機套用 Supabase migration — 待辦步驟

> 目前**暫不使用**此流程時，仍以 Supabase 網頁 **SQL Editor** 貼上專案內 `supabase/migration_*.sql` 執行即可。  
> 以下為之後若改為「在終端機套用 migration」前，建議完成的檢查清單。

---

## 已確認（截至最後一次檢查）

- 本機已安裝 **Supabase CLI**（例如 Homebrew：`/opt/homebrew/bin/supabase`）。
- 專案 `supabase/` 目錄目前僅有手動維護的 `.sql` 檔，**尚無** CLI 初始化後常見的 `supabase/config.toml`，代表**尚未**對遠端專案執行標準的 `link` 流程。
- 在未登入狀態下執行 `supabase projects list` 會出現需 **Access token** 的訊息。

---

## 待完成步驟（需要時再依序做）

### 1. 登入 Supabase CLI（本機執行一次即可）

```bash
supabase login
```

依畫面在瀏覽器完成授權。  
（替代方式：在本機設定環境變數 `SUPABASE_ACCESS_TOKEN`；**勿**將金鑰貼到公開處或聊天。）

### 2. 確認可列出專案

```bash
supabase projects list
```

應能看到你的組織與專案列表示意成功。

### 3. 在此專案目錄連結遠端專案（link）

於 `hair-salon-scheduler` 根目錄：

```bash
cd /Users/ryder/.openclaw/workspace/hair-salon-scheduler
```

若從未用過 CLI 管理此 repo，可能需要先：

```bash
supabase init
```

再連結（`project-ref` 在 Supabase Dashboard → Project Settings → General）：

```bash
supabase link --project-ref <你的_project_ref>
```

完成後應會出現 `supabase/config.toml` 等設定。

### 4. 套用 migration 的方式（擇一或與協作者約定）

- **現況**：migration 以單檔形式放在 `supabase/migration_*.sql`，可繼續用 SQL Editor 執行，或查官方文件使用 `supabase db execute` / 遷移到 `supabase/migrations/` 時間序檔名後以 `db push` 等指令套用。
- **注意**：`supabase status` 預設與本機 Docker 開發 stack 有關；遠端連結與否請以 `config.toml`、`link` 與官方「Remote」流程為準。

### 5. （選用）更新 CLI

```bash
brew upgrade supabase
```

---

## 備註

- 金鑰、資料庫密碼、Service Role 請只放在本機或 Vercel 環境變數，不要提交進 Git。
- 正式環境與測試環境若為不同 Supabase 專案，連結與執行 migration 時請確認 **project-ref** 無誤。

---

**狀態**：待有需要時再執行上述步驟；目前仍以 **SQL Editor 手動 Run** 為主。
