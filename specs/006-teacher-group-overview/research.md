# Research：老師端學生分組情況面板

**Feature**: `006-teacher-group-overview` | **Plan**: [plan.md](./plan.md)

Technical Context 沒有 NEEDS CLARIFICATION（沿用 001～005 技術棧，不新增套件）。以下記錄實作方式的決策。

## R1. 送出者身分的保存方式

- **Decision**: `SubmissionSchema` 新增 `submitterMemberId: z.uuid().nullable().default(null)`；`SubmissionService.submit()`
  建立送出紀錄時一併寫入 `submitter.memberId`（取自已驗證的學生 token，與 `submitterNickname` 相同來源）。
  `data/session.json` 中 006 之前保存、沒有此欄位的送出紀錄，載入時由 `default(null)` 補成 `null`。
- **Rationale**: FR-008 要求依學生身分（不依暱稱）對應組員，伺服器重新啟動後仍保留；token 的 `memberId`（004）已是
  同一分頁固定的身分，送出時直接記下即可。`default(null)` 沿用 004 加 `submitterNickname` 的相容做法，不需資料遷移。
- **Alternatives considered**:
  - 只在記憶體記錄「哪個 memberId 送出哪題」：伺服器重新啟動後標註消失，違反 FR-008。
  - 依暱稱比對：同組同暱稱時會標錯人，違反 FR-008／SC-004。
- **影響範圍**: `Submission` 會隨 `TeacherView.submissions` 傳給老師（老師可見，FR-016 允許）；學生的 `OwnSubmission`
  是另外映射的型別，不含此欄位，學生端資料不變。Guided Notes 匯出與 CSV 匯出不讀此欄位，輸出不變（FR-018）。

## R2. 分組情況在哪裡計算

- **Decision**: 伺服器端新增純函式模組 `apps/server/src/domain/overview/groupOverview.ts`：
  `buildGroupOverview(session, roster, results): GroupOverview[]`，只在 `toTeacherView()` 中呼叫，結果放在
  `TeacherView.groupOverview`。前端只負責顯示。
- **Rationale**: 原則 I 要求可見性由伺服器決定：組員名單、連線狀態與送出者身分只放進老師檢視，學生檢視與公開檢視的
  產生函式完全不碰（FR-016、SC-005）。純函式不依賴傳輸層，可直接單元測試（原則 IV）。名冊、送出、搶答成功三種資料
  在同一處合併，排序規則（FR-003、FR-009）只寫一次。
- **Alternatives considered**:
  - 把名冊原始資料傳給老師端、由前端合併：前端要重做「不在組內」「搶答成功」等規則，兩端規則容易不一致，也較難
    以整合測試證明。
  - 新增獨立的 HTTP 端點讓老師端輪詢：違反原則 II 的即時推播，也無法做到 1 秒內更新。

## R3. 名冊的斷線緩衝狀態與通知

- **Decision**: `GroupRoster` 新增：
  - `isInGrace(memberId): boolean`：連線數為 0 且移除計時器存在時為 true。
  - `RosterChange` 新增兩種 kind：`disconnected`（連線數歸零、開始 30 秒緩衝時）與 `reconnected`（緩衝期內重新連線、
    取消移除計時器時）。
  - `RosterReader` 型別加入 `isInGrace`。
  `RealtimeGateway.onRosterChange()`：
  - 所有名冊變更都額外推播一份 `TeacherView` 給老師 room（目前完全不推播給老師）。
  - `disconnected`／`reconnected` **只**推播給老師 room：人數與成員名單沒有變，學生與公開分頁不需要更新，
    也避免把「某人斷線」的訊號送到學生端（FR-016）。
  - 名冊不是活動狀態，推播時版本號不遞增（沿用 004 規則）。
- **Rationale**: FR-021 要求斷線與重連在 1 秒內反映；目前名冊只在加入、移除、離開、清空時通知，緩衝的開始與結束
  沒有事件。在名冊內部已有的兩個時間點（連線歸零、取消計時器）發出事件是最小改動，30 秒緩衝與人數規則不變（FR-003）。
- **重新整理分頁**: 新連線若比舊連線的斷線先到，連線數是 2→1，不會發出 `disconnected`；若舊連線先斷，會先發
  `disconnected` 再發 `reconnected`，老師端可能短暫看到「連線中斷」，符合 spec Edge Cases 的容許範圍。
- **Alternatives considered**:
  - 老師端自行依時間推算緩衝狀態：老師端拿不到連線事件，無法得知。
  - 為 `disconnected`／`reconnected` 也推播學生檢視：學生資料沒有變，多餘的推播只會增加流量。

## R4. 搶答成功標示的依據

- **Decision**: `buildGroupOverview` 接收 `toTeacherView` 已經算好的 `deriveResults(session, strategy)`；
  標註的 `isWinner` 為「該題 `winner.id` 等於此送出紀錄的 `id`」。
- **Rationale**: 與老師端送出列表、Guided Notes 匯出、CSV 匯出使用同一個判定來源，SC-004 要求 100% 一致；
  不重算、不新增判定規則（FR-010、FR-018）。搶答進行中時 `winner` 是目前第一名，因第一名一旦產生就不會被後來的
  送出取代，標示不會跳動。

## R5. 組員清單的組成與排序

- **Decision**: 每組的 `members`：
  1. 名冊中該組的組員（`roster.membersOf(groupId)`，依加入先後），`inGroup = true`，
     `disconnected = roster.isInGrace(memberId)`；
  2. 之後是「不在組內的送出者」：該組送出紀錄中 `submitterMemberId` 不為 null、且不在名冊該組的身分；依各自第一筆
     送出的 `sequence` 由小到大；暱稱取該身分第一筆送出的 `submitterNickname`（為 null 時顯示「（未記錄暱稱）」）；
     `inGroup = false`、`disconnected = false`。
  每位成員的 `answered` 依題號由小到大；`memberCount` 只算第 1 類（等於 `roster.headcounts` 的值）。
- **Rationale**: 直接對應 FR-003、FR-009、FR-021 與 clarify 補上的排序規則。一位學生的送出一定屬於他 token 的組別，
  且「離開組別」只在「待開始」、送出只在「搶答進行中」，因此不會出現同一身分跨兩組的情況。
- **伺服器重新啟動**: 名冊從空的開始，送出過題目的學生在重連前會暫時顯示為「不在組內」，重連後回到一般組員
  （沒送出過的學生在重連前不顯示），符合 spec Edge Cases。

## R6. 寬窄版面切換

- **Decision**（converge 後修訂）: 新增 hook `useWideLayout()`，以 `window.matchMedia('(min-width: 1600px)')` 監看並回傳
  boolean；`TeacherDashboard` 依結果只渲染一種版面：
  - **寬**：主畫面維持原本的 `mx-auto max-w-5xl`（最寬 1024 px），在視窗中水平置中；面板為 `<aside>` 固定框架
    `fixed top-0 right-0 bottom-0 left-[calc(50%+32rem)] overflow-y-auto overscroll-contain`，左緣正好是主畫面的右緣
    （50% + 1024 px ÷ 2），右緣是視窗右緣；框架內以 `mx-auto w-full max-w-xs` 讓面板水平置中；框架加 `scrollbar-gutter: stable both-edges`，
    內容多出現捲軸時兩側預留相同空間，面板仍左右對稱（瀏覽器量測：未加時左 16 px、右 31 px，加上後各約 30 px）。`fixed` 讓框架不隨頁面捲動，
    `overscroll-contain` 讓框架捲到底時不會帶動主畫面捲動（FR-013）。
  - **門檻 1600 px**：主畫面 1024 px 置中時，右側框架寬為（視窗寬 − 1024）÷ 2；1600 px 時為 288 px，剛好放得下面板。
    原訂的 1280 px（Tailwind `xl`）右側只剩 128 px，放不下面板，因此使用者選擇提高門檻（spec Clarifications）。
  - **窄**：主畫面右側保留 `pr-28` 的空白欄，浮動按鈕 `fixed top-4 right-4` 放在這一欄內，因此捲動到任何位置都
    不會蓋住主畫面的按鈕、輸入欄或文字（FR-012）。按下後顯示右側抽屜（`fixed inset-y-0 right-0`、寬
    `min(22rem, 100vw)`）與半透明背景。
  - 展開狀態放在 `GroupOverviewToggle` 元件內：從窄變寬時該元件卸載，再變窄時重新掛載，自然回到收合（spec US3-5）；
    重新整理後也回到收合（Assumptions）。
- **Rationale**: 只渲染一份面板，避免畫面上同時存在兩個相同的 `aria-label` 區塊，測試與輔助技術都較清楚。用 JS 判斷
  而非純 CSS 斷點，是因為「寬→窄預設收合」需要在版面切換時重設狀態。
- **Alternatives considered**:
  - 純 CSS（`xl:` 前綴切換兩份 DOM）：需同時渲染兩份面板，且無法在切換時重設展開狀態。
  - 原本的 flex＋sticky 側欄（主畫面讓出右側 20rem）：主畫面不在視窗中置中，使用者要求改為置中版面。
  - 維持 1280 px 並讓主畫面縮窄、或主畫面不完全置中：使用者選擇保留主畫面寬度並提高門檻。
- **窄視窗抽屜的關閉方式**（clarify 留給 plan）：關閉按鈕、點背景、按 Esc 三者皆可關閉；開啟時焦點移到關閉按鈕，
  關閉後焦點回到浮動按鈕。抽屜 `role="dialog"`、`aria-modal="true"`、`aria-label="分組情況"`。

## R7. 標記的呈現與可及性

- **Decision**:
  - 題號標記為小型膠囊「第 N 題」，`flex-wrap` 排列（FR-015）。搶答成功：琥珀色底＋「★」前綴，並附
    `title="搶答成功"` 與螢幕閱讀器可讀的「（搶答成功）」隱藏文字（FR-010：不只靠顏色）。
  - 「連線中斷」：暱稱旁的文字標籤（橘色字）。「不在組內」：整列灰色＋文字標籤「不在組內」。兩者都有文字，不只靠顏色。
  - 暱稱使用 `break-words [overflow-wrap:anywhere]`，與 `SubmissionBoard` 既有的長字串處理一致（FR-015）。
  - 面板標題「分組情況」；每組標示「第 N 組」＋「N 人」；空組「尚無組員」；尚未匯入顯示 FR-004 的提示文字。
- **Rationale**: 沿用專案既有的 Tailwind 樣式慣例與長字串處理；文字標籤讓測試可以用文字查詢，也符合可及性。

## R8. 測試策略

- **Decision**:
  - shared：`schemas.test.ts` 驗證 `GroupOverviewSchema` 等新結構，以及缺少 `submitterMemberId` 的舊送出紀錄
    解析為 `null`。
  - server 單元：`groupOverview.test.ts`（排序、同暱稱、不在組內、連線中斷、搶答成功、舊紀錄、空組、未匯入）；
    `groupRoster.test.ts` 補 `disconnected`／`reconnected` 事件與 `isInGrace`（用既有的假計時器）；
    `visibilityPolicy.test.ts` 補老師檢視含 `groupOverview`、學生與公開檢視不含任何新欄位；`localSessionRepository`
    讀取舊格式。
  - server 整合：`roster.test.ts` 補老師 socket 在加入、斷線（緩衝中）、重連、移除、送出後收到正確的
    `groupOverview`；學生 socket 不會因 `disconnected`／`reconnected` 收到推播、收到的資料不含他組名單（SC-005）。
    `submissions.test.ts` 補送出紀錄保存 `submitterMemberId`；既有 Guided Notes／CSV 匯出測試不改並照常通過（SC-006）。
  - web：`GroupOverviewPanel.test.tsx`（各種顯示狀態與文字）、`TeacherDashboard` 版面測試（以 `vi.stubGlobal` 模擬
    `matchMedia`：寬顯示 aside、窄顯示浮動按鈕、展開／Esc／背景關閉、跨斷點重設）、`useWideLayout` 測試。
  - 人工驗證：[quickstart.md](./quickstart.md) 的老師＋兩組學生流程與 1600 px 版面檢查。
- **Rationale**: 原則 VII：可見性（FR-016）有專門的自動化測試；jsdom 不計算版面，sticky／捲動行為以人工驗證補足。

## R9. 相依套件

- **Decision**: 不新增任何套件。`matchMedia` 為瀏覽器內建；圖示用文字「★」，不引入圖示套件。
