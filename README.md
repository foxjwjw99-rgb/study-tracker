# Study Tracker 學習追蹤系統

Study Tracker 是一個為備考情境設計的個人化學習追蹤 app，專注在：

- 記錄讀書時間與學習行為
- 管理題庫、錯題與複習流程
- 用資料幫助使用者判斷目前進度、弱點與上榜機會

目前以 **經濟系轉學考備考** 為主要使用情境，重點科目包含微積分、經濟、英文。

## 專案目標

Study Tracker 想解決的不是單純「記錄今天讀了幾小時」，而是把備考常見的幾個痛點串起來：

1. **學習紀錄分散**：讀書時間、練習結果、錯題、複習常常分散在不同工具
2. **看不出投入是否有效**：花了很多時間，卻不一定知道哪一科最值得補
3. **複習流程容易斷掉**：錯題本、單字本、複習排程很容易各自獨立
4. **缺少考試導向的回饋**：使用者需要的不只是統計，而是「離目標還差多少」

因此這個專案把 **讀書紀錄、題目練習、複習系統、單字系統、排行榜、上榜評估** 放在同一條學習流程裡。

## 功能總覽

### 1. Dashboard
- 學習總覽
- 各科投入狀況
- 準備度與弱點分析
- 上榜機率指數摘要

### 2. Study Logs
- 支援 **手動補登** 與 **計時器紀錄**
- 可記錄科目、主題、學習類型、專注度
- 適合回顧每日 / 每週學習節奏

### 3. Practice
- 支援選擇題與填充題練習
- 即時批改與解析
- 支援 **KaTeX 數學公式渲染**
- 可從 JSON 題庫匯入資料

### 4. Review
- 錯題與單字複習排程
- 題目複習目前採固定級距：**1 / 3 / 7 / 14 天**
- 讓練習後的內容不會做完就消失

### 5. Vocabulary
- 單字本管理
- 整合 **SM-2** 複習邏輯
- 幫助英文單字進入長期記憶，而不是只停留在練習當下

### 6. Analytics
- 學習時間趨勢
- 正確率走勢
- 各科投入分析
- 更容易看出「哪裡花很多時間，但回報不高」

### 7. Admission / 上榜評估
- 目標校系管理
- 模擬考紀錄
- 各科與總分區間預估
- 與上榜線 / 安全線 / 理想線的差距分析
- 上榜等級與信心等級判斷

### 8. Leaderboard
- 讀書群組排行榜
- 可透過邀請碼建立讀書圈
- 適合一起備考時增加互相督促感

### 9. 其他功能
- **Math Graph**：數學函式繪圖工具
- **Rewards**：依累積專注時間換抽獎機會
- **Settings**：個人資料與考試日期設定
- **PWA / 行動端**：支援手機安裝與使用

## 上榜評估（Admission）功能說明

上榜評估頁的目的，是讓使用者知道：

- 目前各科大概落在哪個分數區間
- 加權後總分大概會落在哪裡
- 距離目標校系還差多少
- 下一步最值得優先補哪一科

### 支援內容

- **目標校系管理**
  - 可新增多個目標校系
  - 每個目標可設定：`去年上榜線`、`安全線`、`理想線`

- **各科成績預估**
  - 對每個有設定考綱的科目，產出：`保守 / 中位 / 樂觀` 三段預估分數

- **總分區間預估**
  - 依各科考試權重加總，顯示整體總分區間與中位預估

- **差距分析**
  - 顯示目前總分與 `去年上榜線 / 安全線 / 理想線` 的差距

- **上榜等級判斷**
  - 依與去年上榜線的差距，給出：
    - `高機會`
    - `有機會`
    - `五五波`
    - `偏危險`
    - `很危險`

- **信心等級**
  - 根據模擬考資料量與考綱覆蓋率，顯示 `高 / 中 / 低`

- **讀書投報提示**
  - 找出目前最值得優先投入的科目，幫助判斷下一階段該先補哪科

- **評估快照**
  - 可儲存當下的評估結果，方便之後比較進步幅度

### 評估主要參考資料

上榜評估不是只看單一分數，而是綜合多個學習訊號：

- 最近練習正確率
- 模擬考成績與穩定度
- 考綱單元掌握度
- 考綱覆蓋率
- 待複習數量
- 尚未訂正的錯題數量
- 最近是否長時間未碰某科
- 是否存在高權重但仍偏弱的單元

### 適合的使用情境

- 想知道目前成績大概落在哪個區間
- 想判斷自己距離目標校系還差多少
- 不知道下一階段該優先補哪一科
- 想追蹤模擬考或一段時間後，上榜機率是否有提升

## 重要產品規則

這幾條是目前系統中比較重要、也比較容易忽略的規則：

- **排行榜只計算 `source_type = timer` 的 study logs**
- 手動補登（`manual`）會算進一般學習紀錄與統計，但 **不會進排行榜**
- 如果需要讓某筆補登也進排行榜，該筆資料必須改成 `source_type = timer`
- 目前前端 `study_type` 固定選項為：
  - `看書`
  - `做題`
  - `複習`
  - `上課`

## 技術棧

- **Framework**: Next.js 16
- **Language**: TypeScript
- **Auth**: NextAuth.js（Google / 帳密登入）
- **ORM**: Prisma
- **Database**: PostgreSQL
- **UI**: React 19 + Tailwind CSS 4 + shadcn/ui
- **Charts**: Recharts
- **Math**: KaTeX + math.js

## 本機開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 建立環境變數

複製 `.env.example` 成 `.env`：

```bash
cp .env.example .env
```

範例：

```env
DATABASE_URL="postgresql://user:password@host:5432/study_tracker?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### 3. 建立資料表與 Prisma Client

```bash
npm run db:migrate
npm run db:generate
```

### 4. 啟動開發伺服器

```bash
npm run dev
```

開發環境預設為：

- `http://localhost:3000`

## 部署

### 目前正式部署方式

這個專案目前正式部署目標是 **Zeabur**，並且採用：

- **GitHub repo + Zeabur + PostgreSQL**
- **Dockerfile 部署**

原因是 Zeabur 的 arbitrary Git source 目前不支援可靠的 auto-detect，因此這個專案以 repo 內建的 `Dockerfile` 為主。

### Zeabur 環境變數

```env
DATABASE_URL="postgresql://user:password@host:5432/study_tracker?schema=public"
NEXTAUTH_URL="https://your-domain.zeabur.app"
NEXTAUTH_SECRET="your-secret"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
```

### Zeabur 部署步驟

1. 將專案 push 到 GitHub
2. 在 Zeabur 匯入 repo
3. 新增 PostgreSQL service
4. 把 Zeabur 提供的連線字串填入 `DATABASE_URL`
5. 設定其他必要環境變數
6. 重新部署

### Docker 啟動邏輯

目前 Docker image 啟動時會先執行：

```bash
npx prisma migrate deploy && npm run start
```

正式環境的 app 預設會跑在：

- `PORT=3001`（若平台未覆蓋）

## 舊 SQLite 資料搬到 PostgreSQL

如果要保留原本 SQLite 的資料，可以使用內建搬遷腳本。

### 1. 先建立 PostgreSQL schema

```bash
npm run db:migrate:deploy
```

### 2. 先看來源資料筆數（不寫入）

```bash
npm run db:migrate:data -- --dry-run
```

### 3. 正式搬遷

```bash
SQLITE_PATH=prisma/dev.db npm run db:migrate:data
```

如果目標 PostgreSQL 已經有資料，想先清空再重灌：

```bash
SQLITE_PATH=prisma/dev.db npm run db:migrate:data -- --force-clear
```

### 搬遷前提

- `.env` 中的 `DATABASE_URL` 必須已經指向 **PostgreSQL**
- `SQLITE_PATH` 指向舊 SQLite 檔案（預設為 `prisma/dev.db`）
- 建議先備份原始 SQLite 檔案

## JSON 匯入格式

題目匯入現在採用**統一 JSON 管線**，支援：

- 一般選擇題
- 一般填充題
- 題組
- **同一個 JSON 陣列混合匯入**

### 單題（選擇題）

```json
[
  {
    "subject": "歷史",
    "topic": "台灣史",
    "question": "請問...",
    "question_type": "multiple_choice",
    "options": ["A", "B", "C", "D"],
    "answer": 0,
    "explanation": "因為...",
    "external_id": "history-tw-001"
  }
]
```

### 單題（填充題）

```json
[
  {
    "subject": "英文",
    "topic": "文法",
    "question": "The process is called ___.",
    "question_type": "fill_in_blank",
    "text_answer": "photosynthesis|光合作用",
    "explanation": "多個接受答案用 | 分隔。"
  }
]
```

### 題組

```json
[
  {
    "subject": "國文",
    "topic": "閱讀測驗",
    "group_title": "第一題組",
    "group_context": "閱讀下文，回答第 1–2 題。",
    "external_id": "cn-group-001",
    "questions": [
      {
        "question": "第一小題題目",
        "question_type": "multiple_choice",
        "options": ["A", "B", "C", "D"],
        "answer": 0,
        "external_id": "q1"
      },
      {
        "question": "第二小題（填空）",
        "question_type": "fill_in_blank",
        "text_answer": "答案1|答案2"
      }
    ]
  }
]
```

### 混合匯入

```json
[
  {
    "subject": "數學",
    "topic": "函數",
    "question": "f(x)=x^2 在 x=2 時是多少？",
    "question_type": "multiple_choice",
    "options": ["2", "4", "6", "8"],
    "answer": 1,
    "external_id": "math-func-001"
  },
  {
    "subject": "英文",
    "topic": "文法",
    "question": "The process is called ___.",
    "question_type": "fill_in_blank",
    "text_answer": "photosynthesis|光合作用"
  },
  {
    "subject": "國文",
    "topic": "閱讀測驗",
    "group_title": "閱讀題組 1",
    "group_context": "閱讀下文，回答問題。",
    "questions": [
      {
        "question": "下列何者正確？",
        "options": ["A", "B", "C", "D"],
        "answer": 2
      }
    ]
  }
]
```

### 匯入規則

- 最外層必須是 **JSON 陣列**
- 若物件包含 `questions` 或 `group_context`，系統會視為**題組**
- 否則視為**單題**
- `answer` 使用 **0-based index**（0=A, 1=B, 2=C...）
- 建議提供 `external_id`，系統會優先用它做去重
- 沒有 `external_id` 時，才會退回用題目文字 / 題組情境做重複判斷
- 若是填充題，`text_answer` 可用 `|` 分隔多個接受答案

## Git 注意事項

建議 commit：

- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/migrations/`
- 原始碼與元件
- `Dockerfile`

不要 commit：

- `.env`
- `prisma/dev.db`
- 任何 `.db` / `.sqlite` 檔
- 正式環境資料

## 已知限制

1. 題目複習目前仍以固定級距為主，尚未做到完整自適應 SRS
2. Admission 預測屬於估算模型，結果應視為決策輔助，不是保證錄取
3. 若要從舊 SQLite 正式轉到 PostgreSQL，需要另外執行一次資料搬遷

## Roadmap

- [ ] 題目複習完整自適應 SRS
- [ ] 題庫標籤與進階篩選
- [ ] 更多題型（簡答、排序）
- [ ] 更完整的行動端體驗
- [ ] 讀書群組內題庫共享功能強化
- [ ] 補上 README 截圖 / demo 展示區
