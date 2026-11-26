# 圖表與程式碼一致性驗證（原則 VI）

**Feature**: `006-teacher-group-overview`
**驗證日期**: 2026-11-26
**比對對象**: `diagrams/006-teacher-group-overview-{component,class,sequence}.puml` ↔ plan.md「圖表對應」的原始碼

## 結果

實作完成後逐一比對，發現 6 處命名或職責與圖表不一致（都是細節，沒有改變架構）；依原則 VI 已更新圖表並重新產生 PNG
（`java -jar plantuml.jar -charset UTF-8 "./diagrams/006-*.puml"`），之後兩者一致。

| 圖表元素 | 原始碼 | 結果 |
|----------|--------|------|
| `MemberAnswerTag`、`OverviewMember`、`GroupOverview`、`TeacherView.groupOverview` | `packages/shared/src/views.ts` | 一致（含 refine 不變式） |
| `Submission.submitterMemberId` | `packages/shared/src/domain.ts` | 一致 |
| `groupOverview`：`buildGroupOverview` | `apps/server/src/domain/overview/groupOverview.ts` | 已更新類別圖：私有函式實際為 `bySubmitter`、`tagsOf`（原圖 `tagsByMember`、`absentSubmitters`），新增 `UNKNOWN_NICKNAME` |
| `GroupRoster.isInGrace`、`disconnected`／`reconnected` 事件 | `apps/server/src/domain/roster/groupRoster.ts` | 已更新類別圖：通知方法實際為既有的 `emit`（原圖 `notify`） |
| `VisibilityPolicy.toTeacherView(session, strategy, roster, now)` | `apps/server/src/domain/visibility/visibilityPolicy.ts` | 一致 |
| `viewFor` 傳入 roster | `apps/server/src/transport/views.ts` | 一致 |
| `RealtimeGateway.onRosterChange`（推老師；連線狀態只推老師） | `apps/server/src/transport/realtime/realtimeGateway.ts` | 一致 |
| `SubmissionService` 保存 `submitterMemberId` | `apps/server/src/domain/submission/submissionService.ts` | 一致 |
| `useWideLayout`、門檻常數 | `apps/web/src/hooks/useWideLayout.ts` | 已更新類別圖：常數名稱實際為 `WIDE_LAYOUT_MIN_WIDTH`（原圖 `WIDE_MIN_WIDTH`） |
| `TeacherDashboard` 兩種版面 | `apps/web/src/pages/teacher/TeacherDashboard.tsx` | 已更新類別圖：寬為 `main` ＋ sticky `aside`，窄為 `main`（`pr-28`）＋ `GroupOverviewToggle` |
| `GroupOverviewPanel` | `apps/web/src/pages/teacher/GroupOverviewPanel.tsx` | 已更新類別圖與組件圖：props 實際為 `{ view: TeacherView }`（原圖列 groups／overview／status）；面板不設高度，捲動由外層 `aside`／dialog 負責（原組件圖寫「面板內捲動」） |
| `GroupOverviewToggle`（浮動按鈕＋抽屜、三種關閉方式、焦點） | `apps/web/src/pages/teacher/GroupOverviewToggle.tsx` | 一致 |
| `MemberAnswerTags` | `apps/web/src/pages/teacher/MemberAnswerTags.tsx` | 一致 |
| 時序圖：開啟老師端、加入、送出、斷線／重連／移除、新的活動 | 上述伺服器模組 | 一致（plan 階段已修正 `clear()` 由 RealtimeGateway 呼叫） |
| 灰色（沿用不改）元件：SubmissionBoard、ExportPanel、CsvExportPanel、SessionControls、useSessionState、LocalSessionRepository、StudentClient、RankingStrategy、HttpApi | — | 未修改行為（只有測試資料補新欄位） |

## 第二次更新（converge：寬版面改為置中＋右側框架，T043）

使用者要求主畫面在視窗中置中、分組情況放在主畫面右緣到視窗右緣之間的框架並置中；門檻因此由 1280 px 提高為 1600 px
（spec FR-011 Clarifications）。依原則 VI 先改圖再改程式：

- `006-teacher-group-overview-component.puml`：`TeacherDashboard` 改為「主畫面置中＋固定框架、面板置中」，`useWideLayout` 門檻 1600 px。
- `006-teacher-group-overview-class.puml`：`WIDE_LAYOUT_MIN_WIDTH = 1600`；`TeacherDashboard.render()` 寬版面為置中 `main`（`max-w-5xl`）＋
  `fixed` 的 `aside` 框架（`left = 50% + 32rem`，面板 `mx-auto` 置中）。
- `006-teacher-group-overview-sequence.puml`：版面分支改為 ≥ 1600 px／< 1600 px，並描述置中框架。
- 已重新產生三張 PNG；實作（T044、T045）完成後再次比對，與 `useWideLayout.ts`、`TeacherDashboard.tsx` 一致。
