# 第二大腦 • Second Brain

個人知識系統 — 整合筆記、對話和記憶

## 快速開始

```bash
# 安裝依賴
npm install

# 開發伺服器 (http://localhost:3000)
npm run dev

# 構建生產版本
npm run build
npm start
```

## 功能

- 📋 **統一界面** — 瀏覽所有筆記、記憶和對話
- 🔍 **全域搜尋** — Cmd+K 快速搜尋
- 🏷️ **篩選** — 按類型、日期分類
- 📅 **時間軸** — 查看最近的內容
- 📁 **來源追蹤** — 看清楚每筆筆記來自哪裡

## 結構

```
second-brain/
├── app/
│   ├── api/notes/        # API 端點，讀取筆記
│   ├── layout.tsx        # 根佈局
│   ├── page.tsx          # 主頁面
│   └── globals.css       # 全域樣式
├── components/           # React 組件
│   ├── SearchBar.tsx     # 搜尋欄
│   ├── FilterBar.tsx     # 篩選條件
│   ├── NotesList.tsx     # 筆記列表
│   ├── NoteDetail.tsx    # 筆記詳情
│   └── CommandPalette.tsx # Cmd+K 命令面板
├── lib/
│   ├── types.ts          # 型別定義
│   └── notes.ts          # 筆記讀取邏輯
└── package.json
```

## 資料來源

自動讀取這些位置的筆記：

- `MEMORY.md` — 長期記憶
- `memory/YYYY-MM-DD.md` — 每日日誌
- `notes/**/*.md` — 筆記庫

## 鍵盤快捷鍵

| 快捷鍵 | 功能 |
|--------|------|
| `Cmd+K` | 打開命令面板 |
| `↑↓` | 在命令面板中導航 |
| `Enter` | 選擇筆記 |
| `Esc` | 關閉命令面板 |

## 樣式

使用 **Tailwind CSS** 構建，完全可自訂。主要顏色方案：

- 淺色背景 (slate-50)
- 深色文字 (slate-900)
- 強調藍色 (blue-500)

---

**🦊 Made with care for Jimmy's second brain**
