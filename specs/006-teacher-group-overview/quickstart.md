# Quickstart：老師端學生分組情況面板

**Feature**: `006-teacher-group-overview` | **Plan**: [plan.md](./plan.md)

## 1. 事前準備

與 001 相同：Node.js 26 LTS、Google 服務帳號金鑰、`.env`、課程兩份 Guided Notes 的副本並分享給服務帳號，
詳見 [001 quickstart.md §1](../001-teacher-quiz-session/quickstart.md)。本子功能**不需要**新的環境變數、Google 權限或相依套件。

## 2. 安裝與啟動

```bash
nvm use
```

```bash
npm ci
```

```bash
npm start
```

老師端：<http://localhost:3000/teacher>；學生端：<http://localhost:3000/student>（每個學生用不同分頁）。

## 3. 自動化驗證（每個 Phase 結束時都必須全部通過）

```bash
npm run typecheck
```

```bash
npm run lint
```

```bash
npm run format:check
```

```bash
npm test
```

預期：全部通過；特別確認下列測試存在且通過（詳見 [research.md R8](./research.md)）：

| 測試 | 證明 |
|------|------|
| `apps/server/tests/unit/groupOverview.test.ts` | 排序、同暱稱、不在組內、連線中斷、搶答成功、舊紀錄（FR-003、FR-007～FR-010、FR-021） |
| `apps/server/tests/unit/groupRoster.test.ts` | `disconnected`／`reconnected` 事件與 `isInGrace` |
| `apps/server/tests/unit/visibilityPolicy.test.ts` | 只有老師檢視含 `groupOverview`（FR-016、SC-005） |
| `apps/server/tests/integration/roster.test.ts` | 老師 socket 1 秒內收到更新；學生 socket 不收到連線狀態（SC-002、SC-005） |
| `apps/server/tests/integration/submissions.test.ts` | 送出紀錄保存 `submitterMemberId`、重新啟動後仍在（FR-008） |
| `apps/web/tests/GroupOverviewPanel.test.tsx`、`TeacherDashboard.test.tsx` | 面板文字、寬窄版面、抽屜開關（FR-001～FR-015） |
| 既有匯出、送出測試 | 行為不變（FR-018、SC-006） |

## 4. 人工驗證（老師＋至少兩組學生）

以「單題範例」Guided Notes 匯入、設定 4 組。準備：老師分頁 1 個，學生分頁 4 個（A、B 加入第 1 組且暱稱都改成
「Milo」，C 加入第 1 組暱稱「Ava」，D 加入第 2 組暱稱「Leo」）。結果記錄到 `checklists/manual-verification.md`。

### 4.1 組員名單（US1）

1. 老師端視窗寬度 ≥ 1600 px：主畫面置中，右側框架中央出現「分組情況」，第 1 組「3 人」列出 Milo、Milo、Ava（依加入先後），
   第 2 組「1 人」Leo，第 3、4 組「0 人」「尚無組員」。
2. 新開學生分頁加入第 3 組：老師端 1 秒內出現該暱稱。
3. 「待開始」時 Ava 按「離開組別」：老師端 1 秒內移除 Ava。
4. 關閉 Leo 的分頁：老師端 1 秒內 Leo 旁出現「連線中斷」，第 2 組仍「1 人」；20 秒內重新打開學生端（同一分頁重新
   開啟或用瀏覽器的「重新開啟已關閉分頁」）→「連線中斷」消失。再關閉並等超過 30 秒 → Leo 被移除、第 2 組「0 人」。

### 4.2 回答標註（US2）

1. 讓 Leo 重新加入第 2 組。老師按「開啟搶答」。
2. A（第一個 Milo）送出第 1 題；接著 Leo 送出第 1 題：老師端 A 旁「★ 第 1 題」醒目標示，Leo 旁一般「第 1 題」，
   B（第二個 Milo）沒有標記。滑鼠停在 A 的標記上看到「搶答成功」。
3. A 再送出第 3 題：A 旁依序「第 1 題」「第 3 題」。
4. 關閉 A 的分頁並等超過 30 秒：第 1 組人數少 1，A 以灰色列在最後、標示「不在組內」，保留題號。
5. 老師按「結束搶答」：所有標註保留。
6. 重新整理老師分頁：面板內容與重新整理前相同。
7. 在 C 的學生分頁開啟瀏覽器開發者工具查看 `session:state`：只有本組成員與各組人數，沒有 `groupOverview`、
   沒有他組暱稱、沒有 `submitterMemberId`。

### 4.3 版面（US3）

1. 寬度 1680 px：主畫面在視窗中置中，面板在主畫面右緣到視窗右緣之間的框架中置中；把主畫面捲到最下方（匯出區），面板一直停在原位。
2. 以 `npm run simulate`（README）或多個分頁讓面板內容超過視窗高度：面板內出現捲軸，捲到底時主畫面不動。
3. 視窗拉窄到 1440 px：面板收起，右上角出現「分組情況」按鈕；捲動主畫面時按鈕不動、沒有蓋住任何按鈕或文字。
4. 按下按鈕 → 抽屜展開、資訊相同；分別用「關閉」、點背景、按 Esc 關閉。
5. 抽屜展開時讓一位學生加入：抽屜內 1 秒內更新。
6. 抽屜展開時把視窗拉寬到 ≥ 1600 px → 改為右側固定框架；再拉窄 → 收合。
7. 暱稱改成 20 字的英文長字、讓一位組員送出很多題：面板內自動換行，不撐寬、不截斷。

### 4.4 新的活動

老師重新匯入：面板各組變「0 人」、所有標註消失；學生重新選組後再出現。
