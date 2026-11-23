# 圖表一致性驗證（constitution 原則 VI）

**Feature**: `003-student-quiz-participation` | **Date**: 2026-11-24 | **Task**: T039

依 [plan.md](./plan.md)「圖表對應」逐一核對三張 003 圖表的元件、類別、欄位、方法與互動順序是否都存在於原始碼且
名稱一致。

## 實作過程中更新的圖表

| 圖表 | 更新內容 | 原因 |
|------|----------|------|
| 類別圖 | `QuestionAnswerForm` 移除 `status` 屬性 | 是否可作答已由 `enabled`（`status === 'OPEN'`）表達，表單用不到 `status`；先改圖再實作（T028） |

更新後已執行 `plantuml` 重新產生 PNG。組件圖、時序圖不需要更新。

## 元件與類別對照

| 圖表元素 | 圖表 | 原始碼位置 | 一致 | 說明 |
|----------|------|------------|------|------|
| `QuestionSummary.blankLabels` | 類別圖、組件圖 | `packages/shared/src/views.ts` | ✔ | 以 `refine` 檢查長度等於 `blankCount`；老師題目共用同一組欄位 |
| `StudentView`、`OwnSubmission`、`ResultView`、`SubmitRequest`、`SessionStatus` | 類別圖、組件圖 | `packages/shared/src/{views,api,domain}.ts` | ✔ | 沿用 001，未改動 |
| `VisibilityPolicy.toStudentView(session, groupId, ranking)` | 類別圖、組件圖、時序圖 | `apps/server/src/domain/visibility/visibilityPolicy.ts` | ✔ | 第三個參數在程式中命名為 `strategy`；`base()` 產生 `blankLabels` |
| `StudentPage`（`identity`、`view`、依身分與階段切換畫面） | 類別圖、組件圖、時序圖 | `apps/web/src/pages/student/StudentPage.tsx` | ✔ | `identity` 來自 `useStudentAuth`、`view` 來自 `useSessionState` |
| `useStudentAuth`（`identity`、`token`、`notice`、`join`、`leave`、`onInvalidated`） | 類別圖、組件圖、時序圖 | `apps/web/src/hooks/useStudentAuth.ts` | ✔ | 另含依 `expiresAt` 的到期計時（research R4） |
| `InvalidationReason`（`NEW_ACTIVITY`、`EXPIRED`） | 類別圖 | `apps/web/src/hooks/useSessionState.ts` | ✔ | |
| `useSessionState`（回報失效原因） | 組件圖 | `apps/web/src/hooks/useSessionState.ts` | ✔ | `onUnauthorized(reason)` |
| `JoinGroupPanel`（`status`、`groups`、`notice`、`onJoin`） | 類別圖、組件圖 | `apps/web/src/pages/student/JoinGroupPanel.tsx` | ✔ | |
| `PhaseBanner`（`groupId`、`status`、`connected`、`onLeave`） | 類別圖、組件圖 | `apps/web/src/pages/student/PhaseBanner.tsx` | ✔ | 只有 `READY` 顯示「離開組別」 |
| `AnswerSheet`（`questions`、`ownSubmissions`、`status`、`connected`、`identity`、`onInvalidated`、`jumpTo`） | 類別圖、組件圖 | `apps/web/src/pages/student/AnswerSheet.tsx` | ✔ | `jumpTo` 為模組內函式；每題一個 `QuestionAnswerForm` |
| `QuestionAnswerForm`（`question`、`submitted`、`enabled`、`canSubmit`、`identity`、`onInvalidated`、`submitting`、`submit()`） | 類別圖、組件圖、時序圖 | `apps/web/src/pages/student/QuestionAnswerForm.tsx` | ✔ | `submit()` 回傳 `SubmitOutcome` |
| `AnswerDraftStore`（`load`、`save`、`clear`、`clearAll`、`hasUnsent`） | 類別圖、組件圖、時序圖 | `apps/web/src/student/answerDraftStore.ts` | ✔ | 參數與類別圖相同 |
| `validateDraft`、`blankLabelOf` | 類別圖、時序圖 | `apps/web/src/student/validateDraft.ts` | ✔ | 使用 shared 的 `unicodeLength`、`ANSWER_MAX_LENGTH` |
| `StudentResultBoard`（`questions`、`results`、`ownSubmissions`、`groupId`、`showUnsentNotice`） | 類別圖、組件圖 | `apps/web/src/pages/student/StudentResultBoard.tsx` | ✔ | |
| `groupOutcomes`、`wonCount`、`GroupOutcome`、`OutcomeKind` | 類別圖、時序圖 | `apps/web/src/student/groupOutcomes.ts` | ✔ | |
| `HttpApi`（`POST /api/auth/student`、`POST /api/submissions`） | 組件圖、時序圖 | `apps/server/src/transport/http/routes/{authRoutes,submissionRoutes}.ts` | ✔ | 只在 `authRoutes.ts` 加上加入成功與被拒的 log（FR-028） |
| `RealtimeGateway`、`QuizSessionService`、`SubmissionService`、`LocalSessionRepository`、`TeacherClient` | 組件圖（灰色）、時序圖 | 沿用 001、002 | ✔ | 未改動 |

## 互動順序對照（時序圖）

| 段落 | 對照結果 | 自動化測試 |
|------|----------|------------|
| 加入組別 | ✔ 無 token 連線取得 PublicView → `POST /api/auth/student` → 以 token 重新連線取得 StudentView | `web/StudentPage.test.tsx`、`web/useStudentAuth.test.tsx` |
| 開啟搶答 | ✔ 各組分頁收到 `status = OPEN` 後開放作答 | `web/StudentPage.test.tsx`、`integration/visibility.test.ts` |
| 作答與送出 | ✔ 草稿只存分頁 → `validateDraft` → `POST /api/submissions` → 回應不含順位 → 清除草稿；只推播給同組；同組另一分頁 409 顯示「本組已送出此題」 | `web/QuestionAnswerForm.test.tsx`、`web/AnswerSheet.test.tsx`、`integration/visibility.test.ts`、`integration/concurrency.test.ts` |
| 結束搶答與檢視結果 | ✔ 收到 CLOSED 與 results → `groupOutcomes` → 顯示結果與「本組搶答成功 N 題」 | `web/StudentPage.test.tsx`、`web/StudentResultBoard.test.tsx`、`web/groupOutcomes.test.ts` |
| 開始新的活動 | ✔ `session:reset` → 清除身分與草稿 → 回到選組並顯示「老師已開始新的活動，請重新選擇組別。」 | `web/StudentPage.test.tsx`、`web/useStudentAuth.test.tsx` |

結論：三張 003 圖表與程式碼一致。
