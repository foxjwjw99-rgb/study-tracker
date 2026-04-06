# SubjectUnit 漸進導入方案（Phase 1）

這份文件對應目前第一版 schema 調整，目標是：

- 不砍掉現有 `topic` / `unit_name`
- 先建立正式標準單元層 `SubjectUnit`
- 先讓 `StudyLog` / `PracticeLog` / `ExamSyllabusUnit` 可以掛 `unit_id`
- migration 後即可上線，資料回填可分階段做，不必一次完成

---

## Phase 1 已採用的 schema 原則

### 1. 保留舊欄位

以下欄位全部保留：

- `StudyLog.topic`
- `PracticeLog.topic`
- `ExamSyllabusUnit.unit_name`

原因：

- 現有前端與分析邏輯仍依賴這些欄位
- 歷史資料已大量使用這些字串欄位
- 一次砍掉會讓 migration 與資料回填風險過高

### 2. 先加 nullable `unit_id`

Phase 1 只新增：

- `StudyLog.unit_id`
- `PracticeLog.unit_id`
- `ExamSyllabusUnit.unit_id`

全部允許為空，原因是：

- migration 時不會卡在歷史資料
- 可以先部署，再慢慢補齊 mapping
- 新資料可逐步開始寫入 `unit_id`

### 3. 用 `SubjectUnit` 承接既有 `ExamUnit` 表

目前 schema 採用：

- Prisma model 名稱：`SubjectUnit`
- 對應資料表：`ExamUnit`（透過 `@@map("ExamUnit")`）

這樣做的好處：

- 避免同時存在兩套正式單元表
- 不需要立刻搬動或刪掉既有資料表
- 只需在既有 `ExamUnit` 表上補欄位即可

### 4. alias 以「同一科」為唯一範圍

`SubjectUnitAlias` 採用：

- `@@unique([subject_id, normalized_alias])`

原因：

- 避免同一科兩個單元搶同一個 alias
- 之後做自動 matching 時，比 `@@unique([subject_unit_id, normalized_alias])` 更安全

---

## 建議 migration 順序

## 第 1 次 migration：只做結構

目標：先讓 schema 能上線，不強迫回填。

### 內容

1. 在既有 `ExamUnit` 表上新增欄位：
   - `slug`
   - `is_active`
   - `source`
   - `notes`
2. 新增 `SubjectUnitAlias` 表
3. 在以下表新增 nullable `unit_id`
   - `StudyLog`
   - `PracticeLog`
   - `ExamSyllabusUnit`
4. 建立外鍵與 index

### 注意

- `slug` 在 Phase 1 可先允許 `NULL`
- 這樣舊的 `ExamUnit` 資料不需要在 migration 當下全部補齊
- 等回填完成後，再考慮第二次 migration 把 `slug` 改成 required

---

## 第 2 步：回填正式單元資料

目標：先把「正式單元主表」補齊，再去對歷史資料做 mapping。

### 優先來源

先以 `ExamSyllabusUnit` 為主，因為它最接近你目前 admission / 考綱邏輯的正式單元來源。

### 回填流程

1. 依 `subject_id + unit_name` 建立 / 補齊 `SubjectUnit`
2. 為每個正式單元建立一筆預設 alias：
   - `alias = 原始 unit_name`
   - `normalized_alias = normalize(unit_name)`
3. 如果某科已經有舊的 `ExamUnit` 資料：
   - 優先補 `slug`
   - 確認名稱是否與 `ExamSyllabusUnit.unit_name` 一致
   - 必要時人工整理

---

## 第 3 步：回填 `unit_id`

### 回填順序建議

1. `ExamSyllabusUnit.unit_id`
2. `PracticeLog.unit_id`
3. `StudyLog.unit_id`

這樣的理由：

- `ExamSyllabusUnit` 是正式單元基準
- `PracticeLog` 對 admission / analytics 價值高
- `StudyLog` 最多雜訊，但仍有時間投入價值

### 比對邏輯

每筆資料回填時：

1. 先取出 `subject_id`
2. 讀取該科所有 `SubjectUnitAlias`
3. 將原始字串做 normalize
4. 用 `normalized_alias` 比對
5. 若唯一命中，填入 `unit_id`
6. 若沒命中或命中多筆，列入人工檢查清單

### 建議的 normalize 規則

至少統一：

- 全形 / 半形
- 大小寫
- 空白
- 常見連接符號：`&` / `＆` / `/` / `／`
- 常見標點：`，` / `,` / `、`
- 括號與裝飾字元

例如：

- `極限 和 連續`
- `極限與連續`
- `極限&連續`
- `極限／連續`

最後都應收斂到同一個 `normalized_alias`

---

## 第 4 步：改查詢與分析邏輯

在回填進行期間，所有分析邏輯都建議採用這個優先順序：

1. **優先看 `unit_id`**
2. 若 `unit_id` 為空，再 fallback 到 `topic` / `unit_name`

### 套用範圍

- Dashboard
- Analytics
- Admission / 上榜評估
- 單元覆蓋率
- 單元掌握度

這樣的好處是：

- 新資料會越來越準
- 舊資料仍可正常運作
- 不需要等全部資料回填完才上線

---

## 第 5 步：前端逐步導入

### 最低風險版本

先不要強迫所有表單都改 UI。

可先做：

- 後台維護正式單元與 alias
- 新增 / 編輯資料時，仍保留 `topic` 輸入
- 送出前在 server action 內嘗試 alias matching
- 命中則自動補 `unit_id`
- 沒命中則保留 `topic`，`unit_id = null`

### 之後可再升級

- 讓使用者直接選 `SubjectUnit`
- `topic` 改成選填備註欄位
- 或自動用 `unit.name` 帶出 topic

---

## Phase 2 建議擴充

等 Phase 1 穩定後，再擴到：

- `WrongQuestion.unit_id`
- `ReviewTask.unit_id`
- `Question.unit_id`
- `QuestionGroup`（若之後真的要導入題組層）

不建議第一版就一次全部掛上，因為：

- migration 面太大
- 要改的前端 / action / 匯入流程會一起變多
- debug 成本高

---

## 建議補的 script

之後可以新增一支類似：

- `scripts/backfill-subject-units.mjs`

它至少要做三件事：

1. 從 `ExamSyllabusUnit` 建 / 補 `SubjectUnit`
2. 回填 `ExamSyllabusUnit.unit_id`
3. 回填 `PracticeLog.unit_id` 與 `StudyLog.unit_id`

建議輸出：

- 成功匹配筆數
- 未匹配筆數
- 多重匹配筆數
- 每科 unmatched 範例清單

這樣你才知道還需要人工整理哪些 alias。

---

## 後續收斂方向

等資料回填率夠高後，可以再考慮：

1. 把 `slug` 改成 required
2. 新資料寫入時，盡量強制帶 `unit_id`
3. 讓核心分析完全以 `unit_id` 為主
4. 最後再評估是否要逐步弱化 `topic` / `unit_name`

在那之前，`topic` / `unit_name` 都應保留作為兼容層。
