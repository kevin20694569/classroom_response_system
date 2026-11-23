# Research：學生端搶答作答與結果檢視

**Feature**: `003-student-quiz-participation` | **Plan**: [plan.md](./plan.md)

Technical Context 沒有 NEEDS CLARIFICATION；以下記錄本子功能的設計決策。技術棧、分層與相依套件全部沿用
001、002，不新增套件。

## R1. 學生端路由

- **Decision**: 在 `App.tsx` 新增 `/student` 路徑，顯示 `StudentPage`；首頁的「學生端（子功能 003 提供）」
  占位文字改為連到 `/student` 的按鈕。
- **Rationale**: 001 已用路徑切換老師端（`/teacher`），沿用同一做法最簡單；不需要引入路由套件。
- **Alternatives considered**: 引入 React Router——只有三個頁面，不符 YAGNI。

## R2. 學生身分的保存位置

- **Decision**: token 沿用 001 的 `sessionStorage` 鍵 `crs.token`；加入成功時另存回應中的 `identity`
  （`IdentitySummary`）到 `sessionStorage` 鍵 `crs.identity`，供學生端取得 `activityId`（草稿的鍵）與
  `groupId`（連線前就能顯示組別）。兩者由 `apps/web/src/api/identity.ts` 統一讀寫與清除。
- **Rationale**: `sessionStorage` 每個分頁獨立、重新整理保留、關閉即清除，正是 FR-003（沿用 001 FR-003a）
  要求的行為；token 是伺服器簽章的不透明字串，前端不解析它。`StudentView` 沒有 `activityId`，而草稿必須
  依活動區分，所以保存加入回應中的 `identity`。
- **Alternatives considered**: 在 `StudentView` 加上 `activityId`——要改契約且對畫面沒有其他用途；
  前端解碼 token——依賴 token 格式，違反「token 不透明」的設計。

## R3. 老師身分的分頁打開學生端（FR-008）

- **Decision**: `StudentPage` 有 token 時以 `useSessionState` 連線，若伺服器送來的 `view.viewer` 是
  `teacher`，就顯示「這個分頁目前是老師身分，請另開新分頁以學生身分加入」，不顯示選組與作答功能，也不清除
  老師的 token。
- **Rationale**: 以伺服器回傳的檢視類型判斷身分，不需要前端解析 token（原則 I）；保留老師 token，避免
  老師誤開學生端就被登出。
- **Alternatives considered**: 讀 `crs.identity` 的 `role`——老師登入流程（001）沒有寫入這個鍵，判斷不可靠。

## R4. 身分失效的偵測與訊息（FR-007）

- **Decision**: 三種情況都呼叫 `useStudentAuth.onInvalidated(reason)`，清除 token、`crs.identity` 與該分頁所有
  草稿，回到選組畫面並顯示原因：

  | 來源 | reason | 訊息 |
  |------|--------|------|
  | 推播 `session:reset`（老師匯入新的活動） | `NEW_ACTIVITY` | 老師已開始新的活動，請重新選擇組別。 |
  | 連線被拒 `connect_error: UNAUTHORIZED`（逾時、屬於舊活動、伺服器重啟後活動已換） | `EXPIRED` | 這個分頁的組別身分已失效，請重新選擇組別。 |
  | HTTP 回應 `401 UNAUTHORIZED`（例如送出時才發現逾時） | `EXPIRED` | 同上 |
  | 分頁內依 `identity.expiresAt` 計時到期（分頁一直連著時伺服器不會主動通知逾時） | `EXPIRED` | 同上 |

- **Rationale**: 分頁內計時只是畫面提示，送出時伺服器仍以 401 做最終判定（原則 I）。伺服器在連線被拒時只回 `UNAUTHORIZED`，無法區分逾時與舊活動；兩者對學生的處理相同
  （重新選組），合併成一個訊息即可。`session:reset` 有明確原因，給更具體的說明。
- **Alternatives considered**: 伺服器在 `connect_error` 細分原因——要改 001 的即時契約，對學生沒有額外價值。

## R5. 子題標記（FR-012、FR-021）

- **Decision**: `QuestionSummary` 新增 `blankLabels: (string | null)[]`，依子題序號排列，取自
  `Blank.label`（Guided Notes 裡的「（n）」標記原文）；由 `VisibilityPolicy.base()` 產生，因此公開、學生、
  老師三種檢視都有。學生端顯示規則：
  - 單題：不顯示標記，只有一個輸入欄。
  - 題組：有標記時顯示標記原文（如「（1）」）；沒有標記時顯示「（n）」，n 為子題序號。
- **Rationale**: 標記只是編號，不含題目敘述（FR-022）；放在共用的 `QuestionSummary` 讓三種檢視一致，
  也不需要為學生另外定義題目型別。題組一定有兩個以上的輸入欄，沒有標記時仍需要可區分的名稱。
- **Alternatives considered**: 只傳 `blankCount`、前端一律顯示「（n）」——文件中的標記可能不是從 1 連號
  或使用不同括號，以原文顯示才與學生手上的 Guided Notes 一致。

## R6. 作答草稿（FR-020，Clarifications Q3）

- **Decision**: `AnswerDraftStore` 以 `sessionStorage` 保存，鍵為
  `crs.draft.{activityId}.{groupId}.{questionNumber}`，值為各子題文字的 JSON 陣列；每次輸入就保存（不延遲）。
  清除時機：
  - 該題送出成功；
  - `StudentView.ownSubmissions` 已包含該題（例如同組其他分頁先送出）；
  - 學生離開組別、身分失效（R4）：清除該分頁所有 `crs.draft.` 開頭的鍵。
- **Rationale**: `sessionStorage` 只屬於該分頁，滿足「同組其他分頁與伺服器都看不到」；以 `activityId`
  區分可避免舊活動的草稿出現在新活動。題數 ≤ 100、每格 ≤ 200 字，同步寫入成本可忽略。
- **Alternatives considered**: `localStorage`——同一瀏覽器所有分頁共用，違反 FR-020；存在 React state
  ——重新整理後消失，違反 Clarifications Q3。

## R7. 作答畫面排列（FR-012，Clarifications Q4）

- **Decision**: `AnswerSheet` 由上到下一次列出所有題目，每題一個 `QuestionAnswerForm`（各自的輸入欄、送出
  按鈕、狀態）；上方題號清單是一列按鈕，每個按鈕顯示題號與本組狀態（未作答／已送出），點擊後以
  `scrollIntoView` 捲到該題並把焦點移到第一個輸入欄（`jumpTo`）。
- **Rationale**: 搶答比速度，不需先選題就能作答；題號清單兼顧題數多時的快速移動與狀態總覽。
- **Alternatives considered**: 點題號只顯示一題——Clarifications Q4 已排除。

## R8. 送出流程與錯誤對應（FR-014～FR-019）

- **Decision**: `QuestionAnswerForm.submit()` 依序：
  1. `submitting` 為 true 時直接忽略（FR-019）。
  2. `validateDraft(question, texts)` 檢查：去除前後空白後以 `unicodeLength`（shared，與伺服器同一個函式）
     計 1～`ANSWER_MAX_LENGTH` 字、所有子題都填寫；有問題就在對應子題下方顯示原因，不送出。
  3. `POST /api/submissions`，送出去除前後空白後的文字；組別由 token 決定。
  4. 依結果處理（錯誤代碼沿用 001）：

  | 結果 | 畫面 |
  |------|------|
  | 成功 | 該題立即顯示「已送出」與送出的答案、清除草稿；之後的推播（`ownSubmissions`）為準 |
  | `SESSION_NOT_OPEN` | 「搶答已結束，這次送出沒有被採計」；作答停用（推播也會把狀態改為已結束） |
  | `ALREADY_SUBMITTED` | 「本組已送出此題」；顯示 `ownSubmissions` 裡本組的答案，清除草稿 |
  | `ANSWER_INCOMPLETE`／`ANSWER_INVALID` | 依 `details[].blankIndex` 在子題下方顯示伺服器訊息，保留輸入 |
  | `NETWORK_ERROR` | 「無法連線到伺服器，連線恢復後請再送出一次」，保留輸入 |
  | `UNAUTHORIZED` | 身分失效（R4） |
  | 其他（`QUESTION_NOT_FOUND`、`INTERNAL_ERROR` 等） | 顯示伺服器訊息，保留輸入 |

- **Rationale**: 送出成功後立即顯示，不等推播，畫面回饋更快；推播到達後以伺服器資料為準（原則 I、II）。
  前端驗證與伺服器共用 `unicodeLength` 與 `ANSWER_MAX_LENGTH`，兩邊規則一致（原則 V），伺服器仍做最終判定。
- **Alternatives considered**: 只等推播才顯示已送出——推播與 HTTP 回應幾乎同時到，但在推播延遲時學生會
  以為沒送出而重按。

## R9. 離開組別只限「待開始」（FR-005，Clarifications Q2）

- **Decision**: `PhaseBanner` 只在 `status === 'READY'` 時顯示「離開組別」按鈕；按下後 `useStudentAuth.leave()`
  清除 token、`crs.identity` 與草稿，回到選組畫面。伺服器不需要改動：token 為無狀態簽章，丟棄即等於離開。
- **Rationale**: 「待開始」時還沒有任何送出紀錄，換組不會造成答案歸屬問題；其他階段不提供按鈕，避免搶答中
  換組。加入不需密碼，另開分頁仍能加入其他組，這是 001 的設計，不在本子功能限制（spec 邊界情況）。
- **Alternatives considered**: 伺服器端註銷 token——需要新增狀態與 API，而另開分頁就能繞過，沒有實際效果。

## R10. 連線狀態（FR-010）

- **Decision**: `useSessionState` 已提供 `connected`；`PhaseBanner` 顯示「連線中斷，正在重新連線」，
  `connected === false` 時所有送出按鈕停用（輸入欄仍可輸入，草稿照常保存）。重連後伺服器立即送完整
  `session:state`（001 既有行為），畫面自動回到正確狀態。
- **Rationale**: 沿用 001 的重連還原機制，不需新增事件。允許斷線時繼續輸入，可減少重連後重打。
- **Alternatives considered**: 斷線時連輸入欄一起停用——會讓學生在短暫斷線時無法繼續作答。

## R11. 結果與本組成績（FR-023～FR-026）

- **Decision**: 純函式 `groupOutcomes(results, ownSubmissions, groupId)` 依題號回傳每題的 `GroupOutcome`：
  - `winnerGroupId === groupId` → `WON`；
  - 本組有送出但不是搶答成功組別 → `SUBMITTED_NOT_WON`（同時帶本組答案與搶答成功答案）；
  - 其他 → `NOT_SUBMITTED`。

  題目結果的 `winnerGroupId === null` 時顯示「無人搶答」。搶答成功題數 = `WON` 的數量。
- **Rationale**: 所有資料都已在 `StudentView`（001）裡，前端只做組合；`VisibilityPolicy` 不需要改動就能滿足
  Clarifications Q1（學生拿不到其他組未搶到的答案）。純函式容易測試。
- **Alternatives considered**: 由伺服器計算本組成績——會讓學生檢視多一個重複欄位，沒有必要。

## R12. 測試策略（原則 VII）

- **Decision**:
  - shared：`QuestionSummary.blankLabels` 的 schema 測試。
  - server：`visibilityPolicy` 單元測試與 `visibility` 整合測試加上 `blankLabels` 檢查，並確認學生資料在任何
    階段都不含題目或子題敘述（SC-004）；既有 `concurrency` 測試涵蓋不同組同時送出，同組兩個分頁同時送出另外補測試（SC-005）。
  - web（jsdom，`@testing-library/react`）：`validateDraft`、`groupOutcomes`、`AnswerDraftStore` 單元測試；
    `JoinGroupPanel`、`PhaseBanner`、`QuestionAnswerForm`、`AnswerSheet`、`StudentResultBoard`、`StudentPage`
    元件測試，以假的 `fetch` 與假的 socket 模擬伺服器回應（每個元件至少一個正常與一個錯誤或邊界案例）。
- **Rationale**: 學生端的判定規則都在伺服器（001 已有測試）；本子功能的風險在畫面狀態與錯誤處理，
  以元件測試覆蓋。測試不連線真實伺服器或 Google。
- **Alternatives considered**: 瀏覽器端對端測試（Playwright）——需要新增相依套件；端對端流程改由
  quickstart 的人工驗證清單涵蓋。
