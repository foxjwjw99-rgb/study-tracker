# Study Tracker 學習追蹤系統

這是一個使用 Next.js 開發的個人化學習追蹤系統，專注於記錄學習時間、追蹤學習成效、安排複習，並支援題庫 JSON 匯入與行動裝置使用。

## 專案用途

Study Tracker 的核心目標：
1. **紀錄與管理學習進度**：不只看大科目，也能往 topic / 單元層級追。
2. **自動化錯題本與複習**：讓錯題、單字、排程複習串起來。
3. **看出投入與成效**：幫助備考時找出弱點與高回報區塊。

## 功能總覽

- 📊 Dashboard：學習總覽、準備度、弱點分析
- ⏱ Study Logs：手動 / 計時器紀錄讀書時間
- 📝 Practice：題庫練習、即時批改與解析
- 🔁 Review：錯題與單字的複習排程
- 🎁 Rewards：依累積專注時間換抽獎機會
- 📱 Mobile / PWA：方便手機上使用

## 技術棧

- **Framework**: Next.js 16
- **ORM**: Prisma
- **Database**: PostgreSQL
- **UI**: React 19 + Tailwind CSS 4

## 本機開發

### 1. 安裝依賴

```bash
npm install
```

### 2. 建立環境變數

複製 `.env.example` 成 `.env`，並填入你的 PostgreSQL 連線字串：

```bash
cp .env.example .env
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

## Zeabur 部署

推薦流程：**GitHub repo + Zeabur + PostgreSQL**。

### Zeabur 建議設定

如果你是用 **GitHub App / framework auto-detect** 匯入：

- **Install Command**
  ```bash
  npm install
  ```
- **Build Command**
  ```bash
  npm run build
  ```
- **Start Command**
  ```bash
  npx prisma migrate deploy && npm run start
  ```

如果你是用 **arbitrary Git source** 匯入：

- Zeabur 目前不會自動辨識 Next.js
- 需要使用 repo 內的 `Dockerfile`
- 直接用 Docker 模式部署即可

### Zeabur 環境變數

至少需要：

```env
DATABASE_URL="postgresql://user:password@host:5432/dbname?schema=public"
```

### 部署步驟

1. 將專案 push 到 GitHub
2. 在 Zeabur 匯入該 repo
3. 新增 PostgreSQL service
4. 把 Zeabur 提供的連線字串填到 `DATABASE_URL`
5. 重新部署

## 舊 SQLite 資料搬到 PostgreSQL

如果你要保留目前 `prisma/dev.db` 的資料，可以用內建腳本搬遷。

### 1. 先把 PostgreSQL schema 建好

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

如果目標 PostgreSQL 已經有舊資料，想先清空再重灌：

```bash
SQLITE_PATH=prisma/dev.db npm run db:migrate:data -- --force-clear
```

### 搬遷前提

- `.env` 裡的 `DATABASE_URL` 必須已經是 **PostgreSQL**
- `SQLITE_PATH` 指向你的舊 SQLite 檔（預設就是 `prisma/dev.db`）
- 建議先備份原本的 SQLite 檔案

## Git 注意事項

建議 commit：
- `package.json`
- `package-lock.json`
- `prisma/schema.prisma`
- `prisma/migrations/`
- 原始碼與元件

不要 commit：
- `.env`
- `prisma/dev.db`
- 任何 `.db` / `.sqlite` 檔
- 正式環境資料

## JSON 匯入格式

```json
[
  {
    "subject": "歷史",
    "topic": "台灣史",
    "question": "請問...",
    "options": ["A", "B", "C"],
    "answer": 0,
    "explanation": "因為...",
    "external_id": "123"
  }
]
```

## 已知限制

1. 複習規則目前仍偏固定級距，還不是完整自適應 SRS。
2. 若要從舊 SQLite 正式搬到 PostgreSQL，需要另外做一次資料遷移。

## Roadmap

- [ ] 更成熟的 SRS 演算法
- [ ] 題庫標籤與進階篩選
- [ ] 更多題型
- [ ] 更完整的行動端體驗
