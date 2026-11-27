# 圖表與程式碼一致性驗證（原則 VI）

**Feature**: `007-ui-ux-refresh`
**驗證日期**: 2026-11-28
**比對對象**: `diagrams/007-ui-ux-refresh-{component,class,sequence}.puml` ↔ plan.md「圖表對應」的原始碼

## 結果

實作完成後逐一比對。實作期間有一處設計調整（`usePhaseTransition`、`useNewSubmissionHighlight` 改以伺服器推來的資料物件為單位），
依原則 VI **先**更新類別圖、時序圖、data-model、research R6，再改程式碼；收尾比對時另發現 6 處細節與圖表不一致，
已更新圖表並以 `plantuml "./diagrams/007-*.puml"` 重新產生 PNG，之後兩者一致。伺服器端與共用契約在圖中標為不變，
`git diff origin/main -- apps/server packages/shared scripts` 沒有任何差異。

| 圖表元素 | 原始碼 | 結果 |
|----------|--------|------|
| VisualTheme | `apps/web/src/index.css`（`@theme`、背景、`ui-card`、keyframes、`.ui-anim` 減少動態規則）、`apps/web/src/ui/theme.ts` | 一致 |
| theme（`GROUP_COLORS`、`PHASE_COLORS`、`MEDAL_COLORS`） | `apps/web/src/ui/theme.ts` | 一致；另有 `ON_COLOR`（彩色底上的白字） |
| timing（四個時間常數） | `apps/web/src/ui/timing.ts` | 一致（1800／2800／900／2000 ms） |
| Icon、IconName | `apps/web/src/ui/icons.tsx` | 一致；lucide 1.82 沒有 Music、CircleAlert，改用 Guitar、CircleExclamationPoint（research R2、R7 已更新）；另加入區塊標題與首頁用的意義圖示 |
| groupIdentity、GroupIdentity、GroupColor | `apps/web/src/ui/groupIdentity.ts` | 一致 |
| GroupBadge | `apps/web/src/ui/GroupBadge.tsx` | 已更新組件圖：多了 `showName={false}` 的圓形標記（組員名單、學生端結果使用，contracts/ui-visual.md §3） |
| phaseStyle、PhaseStyle | `apps/web/src/ui/phaseStyle.ts` | 已更新類別圖與組件圖：欄位為 `status`、`label`、`color`、`icon`；提示文字由 `usePhaseTransition` 產生，不在 phaseStyle |
| usePhaseTransition、PhaseTransition | `apps/web/src/ui/usePhaseTransition.ts` | 實作中調整：簽章 `(view, connected)`，先改圖再改程式；`PhaseTransition` 有 `from`、`to`、`text`、`key` |
| PhaseTransitionToast | `apps/web/src/ui/PhaseTransitionToast.tsx` | 一致 |
| RankMedal | `apps/web/src/ui/RankMedal.tsx` | 一致 |
| Celebration | `apps/web/src/ui/Celebration.tsx`；觸發在 `apps/web/src/pages/student/StudentPage.tsx` | 已更新類別圖與組件圖：元件只接收 `active`，何時播放由 StudentPage 決定（原圖寫成元件自己判斷 transition 與是否搶到） |
| ResultReveal | `apps/web/src/pages/teacher/ResultReveal.tsx`；開啟在 `TeacherDashboard.tsx` | 已更新類別圖：接收整份 `view` 與 `onClose`（原圖為 `results`） |
| useNewSubmissionHighlight | `apps/web/src/ui/useNewSubmissionHighlight.ts` | 實作中調整：簽章 `(submissions, connected)`，先改圖再改程式 |
| EmptyState／LoadingState | `apps/web/src/ui/EmptyState.tsx` | 一致；LoadingState 另有 `inline`（老師端標題旁） |
| ConnectionBanner | `apps/web/src/ui/ConnectionBanner.tsx` | 一致（`disconnectedText` 選填） |
| useReducedMotion | `apps/web/src/ui/useReducedMotion.ts` | 一致 |
| Button | `apps/web/src/ui/Button.tsx` | 已更新類別圖：多了 `size`；改用 `ComponentPropsWithRef`，結果揭曉可把焦點移到「關閉」 |
| AnswerLines | `apps/web/src/components/AnswerLines.tsx` | 已更新組件圖：送出列表與結果揭曉共用 |
| SectionHeading、styles（共用 class） | `apps/web/src/ui/SectionHeading.tsx`、`apps/web/src/ui/styles.ts` | 已更新組件圖：plan 未列出的小型共用模組，屬 VisualTheme 的一部分 |
| HomePage | `apps/web/src/pages/HomePage.tsx` | 一致 |
| SubmissionBoard、GroupOverviewPanel、MemberAnswerTags、其他老師端面板 | `apps/web/src/pages/teacher/*.tsx` | 一致 |
| StudentPage、NicknamePanel、JoinGroupPanel、PhaseBanner、GroupMemberList、AnswerSheet、QuestionAnswerForm、StudentResultBoard | `apps/web/src/pages/student/*.tsx` | 已更新組件圖：StudentPage 負責切換提示、慶祝效果與連線橫幅 |
| SessionTimer、StatusBadge | `apps/web/src/components/{SessionTimer,StatusBadge}.tsx` | 一致 |
| 時序圖（加入、開始、送出、重新整理、結束、重連） | 上列元件與 `useSessionState` | 一致：結束時結果畫面立即出現、提示消失後才有慶祝與揭曉；重連後第一份新資料只建立 baseline |
| useSessionState／useStudentAuth、shared、伺服器（灰色） | `apps/web/src/hooks/*`、`packages/shared`、`apps/server` | 沒有變更 |
