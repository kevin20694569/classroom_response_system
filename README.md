# 課堂搶答系統（Classroom Response System）

軟體工程期末專題（SpecKit 組）。把課堂上以填空式學習單（Guided Notes，Google Sheets）進行的搶答活動搬到線上：
老師匯入 Guided Notes、開啟與結束搶答、即時檢視各組作答，最後把搶答成功的答案寫回原本的 Google Sheets。
系統只在本機執行，同一台電腦以多個瀏覽器分頁同時扮演老師與不同組別的學生。

## 啟動（單一指令）

```bash
npm start
```

開啟 <http://localhost:3000/teacher> 進入老師端（密碼見 `.env` 的 `TEACHER_PASSWORD`）；
學生用另外的分頁開啟 <http://localhost:3000/student> 選擇組別加入（不需密碼，每個分頁的身分各自獨立）。

第一次使用前請先完成下方「環境需求」與「設定」。

## 環境需求

- Node.js 26 LTS：在專案根目錄執行 `nvm install && nvm use`（版本固定於 `.nvmrc`）
- 安裝相依套件：`npm ci`
- 連線真實 Google Sheets 時需要 Google 服務帳號金鑰（自動化測試不需要）

## 設定

1. 依 [quickstart.md §1](specs/001-teacher-quiz-session/quickstart.md) 建立 Google 服務帳號、下載金鑰，
   並把 Guided Notes（課程範例請先複製到自己的雲端硬碟）分享給服務帳號 email（編輯者）。
2. 複製 `.env.example` 為 `.env` 並填入老師密碼、token 密鑰與金鑰路徑。
   缺少或格式錯誤時伺服器會拒絕啟動並說明是哪一個變數。
3. `.env`、金鑰檔與 `data/`（活動保存檔）都不納入版控。

## Guided Notes 準備規則

系統依文件內容動態辨識題目，不使用固定的儲存格位置，規則見
[contracts/guided-notes-format.md](specs/001-teacher-quiz-session/contracts/guided-notes-format.md)：

- 需要一列同時有「題號」與「作答」的表頭（「題目」欄可有可無）
- 題號可寫成 `1`、`1.`、`1、`、`Q1`、`第1題`，或全形數字
- 同一題號涵蓋多個作答格即為題組；作答格的「（1）」「（2）」標記可有可無，有寫就必須從（1）連號
- 「題目」欄的敘述會用於老師端的題目預覽（沒有「題目」欄也能匯入，預覽會顯示「文件未提供題目敘述」）
- 匯出時答案寫入原本的作答格，題組保留子題標記（例如「（1）CPU」）。匯出可選三種模式，寫入位置見
  [002 contracts/guided-notes-format.md](specs/002-teacher-dashboard-enhancements/contracts/guided-notes-format.md)：
  - 只有答案：只寫作答格，其他儲存格不會被改動
  - 答案＋組別時間欄：另在表頭列最右側新增「搶答組別」「提交時間」兩欄
  - 答案＋格內附註行：答案下方另起一行，以灰色小字記錄組別與提交時間

## 開發與測試

| 指令 | 說明 |
|------|------|
| `npm run dev` | 開發模式（後端 + Vite 熱重載，網頁在 <http://localhost:5173/teacher>） |
| `npm test` | 執行所有自動化測試（不連線 Google、不需真實憑證） |
| `npm run typecheck` | TypeScript 型別檢查（strict） |
| `npm run lint` | ESLint 檢查 |
| `npm run format` | Prettier 格式化 |
| `npm run simulate -- --group 1 --question 1 --answers "CPU"` | 模擬學生送出（自動化與壓力測試用；學生畫面見 `/student`） |

人工驗證步驟見 [001 quickstart.md §4](specs/001-teacher-quiz-session/quickstart.md)、
[002 quickstart.md §4](specs/002-teacher-dashboard-enhancements/quickstart.md) 與
[003 quickstart.md §4](specs/003-student-quiz-participation/quickstart.md)。

## 專案結構

```text
packages/shared/   前後端共用契約（Zod schema 與型別）
apps/server/       後端：Fastify HTTP API、Socket.IO 即時推播、Google Sheets 存取
apps/web/          前端：React + Vite + Tailwind CSS（老師端 /teacher、學生端 /student）
scripts/           模擬學生腳本
specs/             SpecKit 文件（spec、plan、tasks、contracts…）
diagrams/          PlantUML 圖表（.puml 與 .png）
```

## 子功能

| 編號 | 內容 | 狀態 |
|------|------|------|
| 001 | 使用者角色與老師端搶答活動管理（匯入、開啟／結束、檢視、匯出） | 已實作 |
| 002 | 老師端介面優化（題目預覽、搶答計時、提交時間提示、匯出模式） | 已實作 |
| 003 | 學生端畫面（`/student`：加入組別、作答與送出、檢視結果） | 已實作 |
