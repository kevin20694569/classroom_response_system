# 圖表一致性驗證（constitution 原則 VI）

**Feature**: `004-student-side-refinements` | **Date**: 2026-11-25 | **Task**: T051

依 [plan.md](./plan.md)「圖表對應」逐一核對三張 004 圖表的元件、類別、欄位、方法與互動順序是否都存在於原始碼且
名稱一致。

## 實作過程中更新的圖表

| 圖表 | 更新內容 | 原因 |
|------|----------|------|
| 類別圖 | `NicknameRules` 改為 `NICKNAME_MAX_LENGTH`、`NICKNAME_RULE_MESSAGE`、`NicknameSchema` | 規則以單一 Zod schema 表達（去除前後空白＋驗證），前後端共用，不另外拆成兩個函式（原則 V） |
| 類別圖 | `GroupRoster`：欄位名 `entries`；`leave(memberId, groupId)`；`headcounts(groups)`；`onChange` 回傳取消訂閱函式 | 組員已在緩衝到期後被移除時仍要能記為已離開並推播，因此帶入 token 的組別；人數依匯入的組別清單產生 |
| 類別圖 | `VisibilityPolicy.toStudentView(session, groupId, strategy, roster)` | 沿用 003 以組別產生學生檢視，名冊另外傳入 |
| 類別圖 | `SubmissionService.submit(submitter, request): SubmitResponse` | 送出者為 token 解析出的組別、memberId 與暱稱；回應格式沿用 001 |
| 類別圖 | `planExport(session, results, fresh, mode): ExportPlan` | 沿用 002 的簽章，只加送出者欄與附註行暱稱 |
| 類別圖 | `StudentPage` 加 `editingNickname`、`leaveError`；`NicknamePanel` 改為 `value`、`error`、`onCancel?`（移除 `shuffle()`）；`randomNickname(exclude?)`；`QuestionContent` 加 `blankCount`、`titleAs?`、`hideTitle?`；新增 `StudentResultBoard ..> QuestionContent` | 「換一個」直接在元件內呼叫 `randomNickname`；修改暱稱可取消；結果畫面也共用題目版面 |
| 類別圖、組件圖 | `NicknameStore` 由 `StudentPage` 使用（不是 `NicknamePanel`） | 暱稱頁只回傳確認的暱稱，保存與讀取由頁面負責 |
| 組件圖 | `randomNickname` 標示「faker 英文語系」；暱稱規則改為 `NicknameSchema` | analyze 後改用持續維護的 `@faker-js/faker`（research R1） |
| 時序圖 | 加入組別時，名冊推播先送給其他分頁，自己的完整 StudentView 最後送出；`leave(memberId, groupId)`；暱稱驗證改為 `NicknameSchema` | 連線的分頁先加入名冊、再進組別 room，只收到一份包含自己的完整狀態，避免重複推播 |

更新後已執行 `plantuml "./diagrams/004-*.puml"` 重新產生 PNG。

## 元件與類別對照

| 圖表元素 | 圖表 | 原始碼位置 | 一致 | 說明 |
|----------|------|------------|------|------|
| `StudentJoinRequest`（`groupId`、`nickname`） | 類別圖、組件圖、時序圖 | `packages/shared/src/api.ts` | ✔ | strict；暱稱以 `NicknameSchema` 正規化 |
| `StudentIdentity`（`memberId`、`nickname`） | 類別圖、時序圖 | `packages/shared/src/api.ts`（`IdentitySummary`）、`apps/server/src/auth/tokens.ts`（`TabIdentitySchema`） | ✔ | 缺新欄位的舊 token 驗證失敗 |
| `GroupHeadcount`、`GroupMember`、`QuestionTexts`、`StudentQuestionView` | 類別圖、組件圖 | `packages/shared/src/views.ts` | ✔ | `blankPrompts` 長度以 `refine` 檢查 |
| `Submission`／`OwnSubmission`／`ResultView`.`submitterNickname` | 類別圖、組件圖 | `packages/shared/src/{domain,views}.ts` | ✔ | `Submission` 預設 `null`（舊資料） |
| `PublicView.headcounts`、`StudentView.{headcounts, members, questions}` | 類別圖 | `packages/shared/src/views.ts` | ✔ | |
| `NicknameRules` | 類別圖、組件圖 | `packages/shared/src/nickname.ts` | ✔ | |
| `GroupRoster`、`RosterEntry` | 類別圖、組件圖、時序圖 | `apps/server/src/domain/roster/groupRoster.ts` | ✔ | 計時器以建構參數注入；`hasLeft`、`clear`、`membersOf` 同名 |
| `VisibilityPolicy`（`toPublicView`、`toStudentView`） | 類別圖、組件圖、時序圖 | `apps/server/src/domain/visibility/visibilityPolicy.ts` | ✔ | `content` 只在 OPEN／CLOSED |
| `SubmissionService.submit` | 類別圖、組件圖、時序圖 | `apps/server/src/domain/submission/submissionService.ts` | ✔ | |
| `exportPlan`（`attribution`、`resultColumnWrites`） | 類別圖、組件圖 | `apps/server/src/domain/export/exportPlan.ts`、`domain/guidedNotes/parser.ts` | ✔ | 表頭「搶答送出者」 |
| `HttpApi`（加入、`POST /api/auth/student/leave`） | 組件圖、時序圖 | `apps/server/src/transport/http/routes/authRoutes.ts` | ✔ | 非 READY 回 409 `LEAVE_NOT_ALLOWED` |
| `RealtimeGateway`（連線／斷線通知名冊、名冊推播、reset 清空） | 組件圖、時序圖 | `apps/server/src/transport/realtime/realtimeGateway.ts` | ✔ | 已離開組員的連線由伺服器中斷 |
| `AuthService`／tokens（memberId、暱稱、已離開失效） | 時序圖 | `apps/server/src/auth/{authService,tokens}.ts` | ✔ | `isMemberLeft` 由 `app.ts` 注入 |
| `StudentPage` | 類別圖、組件圖、時序圖 | `apps/web/src/pages/student/StudentPage.tsx` | ✔ | 由 `App.tsx` 延遲載入（research R1） |
| `NicknamePanel`、`randomNickname`、`NicknameStore` | 類別圖、組件圖、時序圖 | `apps/web/src/pages/student/NicknamePanel.tsx`、`apps/web/src/student/{randomNickname,nicknameStore}.ts` | ✔ | |
| `JoinGroupPanel`（`headcounts`、`nickname`、`onEditNickname`） | 類別圖、組件圖 | `apps/web/src/pages/student/JoinGroupPanel.tsx` | ✔ | |
| `GroupMemberList` | 類別圖、組件圖 | `apps/web/src/pages/student/GroupMemberList.tsx` | ✔ | |
| `PhaseBanner`（暱稱） | 組件圖 | `apps/web/src/pages/student/PhaseBanner.tsx` | ✔ | |
| `AnswerSheet`／`QuestionAnswerForm`、`StudentResultBoard` | 類別圖、組件圖 | `apps/web/src/pages/student/{AnswerSheet,QuestionAnswerForm,StudentResultBoard}.tsx` | ✔ | 有敘述時以 `QuestionContent` 呈現 |
| `QuestionContent` | 類別圖、組件圖、時序圖 | `apps/web/src/components/QuestionContent.tsx`（`QuestionPreview.tsx` 改用） | ✔ | |
| `useStudentAuth`（`join(groupId, nickname)`、`leave(): Promise<void>`） | 類別圖、組件圖 | `apps/web/src/hooks/useStudentAuth.ts` | ✔ | |
| `SubmissionBoard`（送出者） | 類別圖、組件圖 | `apps/web/src/pages/teacher/SubmissionBoard.tsx` | ✔ | |
| `QuizSessionService`、`LocalSessionRepository`、`useSessionState`（灰色） | 組件圖 | 沿用，未改動 | ✔ | |

## 互動順序（時序圖）

| 段落 | 原始碼 | 一致 |
|------|--------|------|
| 取得暱稱：`load()` → 預填隨機名字 → 驗證 → `save()` | `StudentPage.tsx`、`NicknamePanel.tsx` | ✔ |
| 加入組別：加入 API → 以 token 重連 → `connected()` → 推播其他分頁 → 送出自己的完整狀態 | `authRoutes.ts`、`realtimeGateway.ts` | ✔ |
| 重新整理與斷線：`disconnected()` 開始緩衝、重連 `connected()` 取消移除 | `groupRoster.ts`、`realtimeGateway.ts` | ✔ |
| 開啟搶答：學生檢視含 `content`，公開檢視不含 | `visibilityPolicy.ts` | ✔ |
| 送出答案：送出者取自 token，同組與老師即時看到 | `submissionService.ts`、`submissionRoutes.ts`、`realtimeGateway.ts` | ✔ |
| 離開組別：離開 API → `leave()` → 204 → 推播 → 前端清除身分 | `authRoutes.ts`、`useStudentAuth.ts` | ✔ |
| 新的活動：`clear()`、`session:reset`、暱稱保留 | `realtimeGateway.ts`、`useStudentAuth.ts` | ✔ |

結論：三張 004 圖表與原始碼一致。

## converge 新增（Phase 8～9，批改已拔除）

converge 曾加入老師批改（勾選答對、批改完成、依批改決定搶答成功與匯出），使用者人工驗證後決定拔除，圖表與程式都已移除
相關元素；保留的只有學生端計時與暱稱頁文字。

| 圖表元素 | 圖表 | 原始碼位置 | 一致 | 說明 |
|----------|------|------------|------|------|
| `StudentView.{openedAt, closedAt, serverNow}` | 類別圖 | `packages/shared/src/views.ts` | ✔ | `toStudentView` 另傳入伺服器時間 |
| `SessionTimer`（共用） | 類別圖、組件圖 | `apps/web/src/components/SessionTimer.tsx` | ✔ | 學生端放在 `PhaseBanner` 的 `timer` |

結論：圖表與原始碼一致。
