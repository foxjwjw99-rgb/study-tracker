# Question Import Pipeline（Phase 1）

這份文件說明目前 `study-tracker` 題目匯入的第一波整理方向。

## 這一版做了什麼

- 統一 JSON 匯入規格
- 支援混合匯入：單題 / 填充題 / 題組
- 新增 parser / normalizer
- 用 Zod 做正式驗證
- 在正式寫入前提供預覽摘要
- 匯入時優先用 `external_id` 去重
- 題組改為 transaction 內：先建 `QuestionGroup`，再建子題 `Question`

## 目前主入口

- `src/app/import/import-client.tsx`

這個入口負責：

1. 貼上 / 上傳 JSON
2. 去除 markdown code fence
3. 做 payload normalize
4. 執行 schema 驗證
5. 顯示預覽摘要
6. 送到 server action 正式匯入

## 目前保留的輔助入口

- `src/app/import/question-group-import-client.tsx`

這個入口保留給：

- 題組 JSON 匯入
- CSV / Excel 題組表格匯入

## Phase 2 可以再做的事

- 對 grouped question 的 `group external_id + child external_id` 做更完整持久化
- 匯入歷史紀錄
- 匯入失敗明細下載
- 匯出成同格式 JSON
- 與 `SubjectUnit` 自動對應
