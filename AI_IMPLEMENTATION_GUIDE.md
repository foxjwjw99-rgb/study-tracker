# Study Tracker AI 功能實作指南

## ✅ 已完成

### 1. 代碼框架
- `prisma/migrations/add_ai_fields/migration.sql` - Schema 變更
- `prisma/schema.prisma` - 新增欄位和 enum
- `src/lib/ai/gemma.ts` - Gemma 4 API 層
- `src/app/actions/ai-generation.ts` - Server Actions（題目解析 + 批量驗證）
- `src/app/import/unit-mapping-client.tsx` - 批量驗證 UI

### 2. Schema 改動
- `Question.ai_explanation` - AI 生成的解析
- `QuestionGroup.ai_unit_mapping_status` - 對應狀態 (PENDING/COMPLETED/FAILED)
- `QuestionGroup.ai_unit_mapping_note` - 對應理由/失敗訊息
- `QuestionGroup.ai_unit_mapping_at` - 最後更新時間

---

## 🔧 部署步驟

### 步驟 1：執行 Migration
```bash
cd /Users/huli/讀書/study-tracker
npx prisma migrate dev --name add_ai_fields
```

這會：
- 在資料庫新增欄位
- 生成 Prisma Client

### 步驟 2：設置 Zeabur Env
在 Zeabur Dashboard > 環境變數，新增：

```env
GOOGLE_GEMMA_API_KEY=<你的 Google Gemini API key>
GOOGLE_GEMMA_MODEL=gemma-4-31b-it
```

**如何申請 API key：**
1. 去 https://aistudio.google.com/
2. 建立新的 API key
3. 複製 key 到 Zeabur 環境變數

### 步驟 3：新增匯入頁 Tab
編輯 `src/app/import/page.tsx`，在 Tabs 內加：

```tsx
<TabsContent value="unit-mapping">
  <UnitMappingClient 
    subjects={subjects}
    subjectUnits={subjectUnits}
  />
</TabsContent>
```

並在 TabsList 加：
```tsx
<TabsTrigger value="unit-mapping">批量驗證</TabsTrigger>
```

同時在 page 頂部 import：
```tsx
import { UnitMappingClient } from "@/app/import/unit-mapping-client"
```

### 步驟 4：在題目編輯 Dialog 加「生成解析」按鈕
編輯 `src/app/import/question-management-client.tsx`，在編輯 Dialog 的「解析」欄位旁加：

```tsx
import { generateQuestionAiExplanation } from "@/app/actions/ai-generation"

// 在 Dialog content 裡找到解析欄位
<div className="space-y-2">
  <Label>解析</Label>
  <Textarea
    value={editForm.explanation}
    onChange={(e) => setEditForm({ ...editForm, explanation: e.target.value })}
  />
  <Button
    type="button"
    size="sm"
    variant="outline"
    onClick={async () => {
      const result = await generateQuestionAiExplanation(question.id)
      if (result.success) {
        setEditForm({ ...editForm, explanation: result.explanation })
        toast.success("已生成 AI 解析")
      } else {
        toast.error(result.error)
      }
    }}
  >
    🤖 生成解析
  </Button>
</div>
```

### 步驟 5：在練習流程顯示 AI 解析
編輯 `src/app/actions/practice-log.ts`，在撈題時帶上 `ai_explanation`：

```ts
const question = await tx.question.findUnique({
  where: { id: questionId },
  select: {
    // 既有欄位...
    explanation: true,
    ai_explanation: true,  // ← 加這行
  }
})
```

然後在顯示解析的地方用：
```tsx
{question.explanation || question.ai_explanation}
// 或更明確：
{question.explanation ? (
  <>
    <p className="text-sm text-muted-foreground">解析（人工整理）</p>
    <p>{question.explanation}</p>
  </>
) : question.ai_explanation ? (
  <>
    <p className="text-sm text-muted-foreground">解析（AI 生成）</p>
    <p>{question.ai_explanation}</p>
  </>
) : null}
```

---

## 📋 使用流程

### 用法 1：為新題生成解析
1. 去「匯入」→「題目管理」
2. 找到要加解析的題目，點編輯
3. 在「解析」下按「🤖 生成解析」
4. AI 會生成解析並自動帶入
5. 可編輯後保存

### 用法 2：批量驗證舊題目的單元
1. 去「匯入」→「批量驗證」
2. 選擇科目
3. 按「🤖 AI 分析建議」
4. AI 會分析每個題組，建議最合適的單元
5. 預覽表格顯示：
   - 目前 topic
   - 目前單元
   - AI 建議單元
   - 信心度百分比
   - 可手動覆蓋
6. 勾選要套用的題組
7. 按「✅ 確認對應」
8. 系統會：
   - 更新 QuestionGroup 的 unit_id 和 topic
   - 更新子題的 unit_id 和 topic
   - 舊 topic 寫成 alias（未來自動複用）

---

## 🔍 測試檢查清單

- [ ] Migration 執行成功
- [ ] Zeabur env 設定正確
- [ ] 題目編輯 Dialog 能按「生成解析」
- [ ] 能成功生成解析（需要網路和 API key）
- [ ] 匯入頁有「批量驗證」tab
- [ ] 能預覽題組和 AI 建議
- [ ] 能確認對應並更新資料庫
- [ ] 練習時能看到 AI 解析

---

## 🐛 常見問題

### Q: 生成解析時出現 401 或 403 錯誤
A: 檢查 Zeabur env 裡的 `GOOGLE_GEMMA_API_KEY` 是否正確和有效。

### Q: 預覽時沒有 AI 建議
A: 可能原因：
- 可用單元太少
- AI 信心度太低（低於 0.3）
- API 超時
檢查後端日誌。

### Q: 確認後資料沒有更新
A: 檢查是否有 user_id 或 subject_id 不匹配的情況，或資料庫連線問題。

---

## 📌 後續功能（可選）

1. **智能復習建議** - 根據答錯率推薦復習順序（嵌入複習頁）
2. **學習進度分析** - Dashboard 加 AI 摘要卡
3. **自動出題** - 根據教材生成練習題

這些功能用同樣的 Gemma 4 API，實作邏輯類似。

---

## 📞 聯繫

有問題找狐狸 🦊
