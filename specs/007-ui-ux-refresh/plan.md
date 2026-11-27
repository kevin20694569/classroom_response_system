# Implementation Plan: 介面視覺與互動體驗改版

**Branch**: `007-ui-ux-refresh` | **Date**: 2026-11-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-ui-ux-refresh/spec.md`

## Summary

在不改變任何流程、規則、伺服器資料與既有文字的前提下，把首頁、老師端、學生端改成一致的「活潑遊戲感」介面：
全站共用的配色、圓角卡片、三種按鈕；每組固定的顏色＋圖示；階段強調色與「搶答開始！」「搶答結束」切換提示；
送出成功、金銀銅名次、新送出滑入、學生端慶祝紙片、老師端結果揭曉；等待、空白、連線狀態的圖示與動態；
並支援減少動態效果、對比與 375～1920 px 版面。

技術做法（詳見 [research.md](./research.md)）：

- 主題分兩個唯一來源：`index.css` 的 Tailwind `@theme`（背景、卡片、字型、keyframes）與 `ui/theme.ts` 的 hex 色票
  （組別色、階段色、金銀銅色），後者讓對比可以在單元測試中計算（R1、R9）。
- 組別識別 = 10 色循環 × 20 個不重複的圖示，保證 2～20 組兩兩不同、白字對比 ≥ 4.5:1（R2）。
- 新增 `lucide-react`（圖示）與 `@fontsource-variable/nunito`（英數字圓體），都打包進建置結果、離線可用（R3、R4）。
- 動畫全用 CSS keyframes＋`prefers-reduced-motion`；慶祝紙片自己實作，不加動畫函式庫（R5）。
- `usePhaseTransition(view, connected)` 以「本分頁 baseline」判斷當場看到的階段變化，切換提示、慶祝效果、結果揭曉
  共用；重連與重新整理不觸發，也不需要儲存（R6）。
- 伺服器、`packages/shared` 完全不改（R11）。

## Technical Context

**Language/Version**: TypeScript 6.0（strict）；Node.js 26 LTS（沿用 001）

**Primary Dependencies**: 沿用 001～006（React 19、Vite 8、Tailwind CSS 4、Socket.IO client 4、Zod 4）；
**新增** `lucide-react` 1.x（圖示，ISC）與 `@fontsource-variable/nunito` 5.x（字型，OFL-1.1），兩者皆持續維護（R3、R4）

**Storage**: N/A（不新增保存資料；前端效果狀態只在元件記憶中，data-model §3）

**Testing**: Vitest 5（web project，jsdom）＋Testing Library；假時鐘驗證提示、慶祝、新送出動態的時間；以既有
`installMatchMedia` 模擬減少動態效果；色票對比以測試輔助函式計算。實際動畫觀感、版面寬度、離線顯示以人工驗證

**Target Platform**: 沿用 001（本機 Node.js；桌面與手機的現代瀏覽器，375～1920 px）

**Project Type**: Web 應用程式（沿用 npm workspaces monorepo；本子功能只改 `apps/web`）

**Performance Goals**: 切換提示在推播後同一次渲染出現（SC-004 的 1 秒內）；送出按鈕的處理中外觀在按下的同一次渲染出現
（FR-028）；動畫只用 CSS，不增加 React 重新渲染

**Constraints**: 既有文字、`aria-label`、伺服器資料與可見性不變（FR-027）；離線可用（FR-026）；主程式 gzip ≤ 140 kB、
學生端 gzip ≤ 180 kB、所有 JS 檔 < 500 kB（R10）；色票對比 ≥ 4.5:1（FR-024）

**Scale/Scope**: 2～20 組、≤ 100 題；改版範圍為首頁、老師端全部面板、學生端全部畫面

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原則 | 檢查重點 | 本計畫的做法 | 結果 |
|------|----------|--------------|------|
| I. 伺服器為唯一真實來源 | 判定與可見性由伺服器決定 | 階段、名次、搶答成功、答案都直接使用伺服器推播的 `SessionView`；學生端獎盃與慶祝只用 `StudentView.results` 與 `ownSubmissions`，結果揭曉只用老師已拿到的 `TeacherView.results`；不新增任何資料傳輸 | 通過 |
| II. 即時同步與狀態一致 | 即時推播、重連還原、狀態機 | 不新增活動狀態；畫面仍完全由推播的 view 決定。效果的「階段變化」以 baseline 規則明確定義（data-model §3 狀態圖），重連後回到正確畫面且不重播效果 | 通過 |
| III. 資料驅動的外部文件處理 | 不寫死位置 | 不讀寫 Guided Notes；匯出行為不變，以既有測試證明 | 通過（不適用） |
| IV. 模組化與可擴充設計 | 分層、不過度設計 | 共用視覺元件集中在 `apps/web/src/ui/`；組別識別、階段樣式為純函式；只為「組別識別」「階段樣式」「意義圖示」建立對照表，因為它們被多個畫面共用（FR-006、FR-009）；不建立主題切換等未要求的抽象 | 通過 |
| V. 型別安全與契約 | 契約集中、執行期驗證、不用 `any` | 不改共用契約；`IconName`、`GroupIconName`、`ButtonVariant` 以字串聯集型別限制；色票以 `as const` 定義；不使用 `any` | 通過 |
| VI. PlantUML 設計優先 | 圖表為藍圖 | specify／clarify 已建立 `diagrams/007-ui-ux-refresh-*`；本 plan 定案後**先更新**類別圖（`usePhaseTransition` 加 `connected`、`useNewSubmissionHighlight` 加 `connected`、新增 `theme`／`timing`／`Icon`）並重新產生 PNG；下方「圖表對應」列出原始碼位置 | 通過 |
| VII. 測試與驗證 | 正常＋錯誤案例、專門測試、人工清單 | 每個新模組有正常與邊界測試（R9）；「當場才出現」的規則有專門的重連、重新整理測試；可見性不變由既有測試與「只用既有 view 欄位」保證；[quickstart.md](./quickstart.md) §5 有老師＋兩組學生的人工驗證 | 通過 |
| VIII. 安全與機敏資料 | 不洩漏、角色權限 | 不新增環境變數、不改權限；不引用外部網路資源 | 通過 |
| 技術限制 | Node LTS、單一指令、lock file、lint/format、不用停更套件 | 新增的兩個套件 2026 年仍有發布並寫入 lock file；`npm start` 不變；ESLint／Prettier 照常檢查；不新增 log（純前端呈現） | 通過 |
| 開發流程 | 獨立 branch、clarify／analyze／converge | 在 `007-ui-ux-refresh` branch（從 main 開）；specify 3 題＋clarify 三輪 9 題已完成；tasks 後執行 analyze，implement 後執行 converge | 通過 |

**Phase 1 設計後重新檢查**：data-model、contracts、quickstart 沒有引入新的違反項目；Complexity Tracking 不需填寫。

### 圖表對應（原則 VI：以圖表為藍圖）

| 圖表元素 | 圖表 | 原始碼位置 |
|----------|------|------------|
| VisualTheme | 組件圖 | `apps/web/src/index.css`（`@theme`、keyframes、減少動態規則）、`apps/web/src/ui/theme.ts`（色票） |
| Button | 組件圖、類別圖 | `apps/web/src/ui/Button.tsx` |
| Icon、IconName | 組件圖、類別圖 | `apps/web/src/ui/icons.tsx` |
| groupIdentity、GroupIdentity、GroupColor | 組件圖、類別圖 | `apps/web/src/ui/groupIdentity.ts` |
| GroupBadge | 組件圖 | `apps/web/src/ui/GroupBadge.tsx` |
| phaseStyle、PhaseStyle | 組件圖、類別圖 | `apps/web/src/ui/phaseStyle.ts` |
| usePhaseTransition、PhaseTransition | 組件圖、類別圖、時序圖 | `apps/web/src/ui/usePhaseTransition.ts` |
| PhaseTransitionToast | 組件圖、類別圖、時序圖 | `apps/web/src/ui/PhaseTransitionToast.tsx` |
| RankMedal | 組件圖、類別圖 | `apps/web/src/ui/RankMedal.tsx` |
| Celebration | 組件圖、類別圖、時序圖 | `apps/web/src/ui/Celebration.tsx` |
| ResultReveal | 組件圖、類別圖、時序圖 | `apps/web/src/pages/teacher/ResultReveal.tsx` |
| useNewSubmissionHighlight | 組件圖、類別圖 | `apps/web/src/ui/useNewSubmissionHighlight.ts` |
| EmptyState／LoadingState | 組件圖、類別圖 | `apps/web/src/ui/EmptyState.tsx` |
| ConnectionBanner | 組件圖、類別圖 | `apps/web/src/ui/ConnectionBanner.tsx` |
| useReducedMotion | 組件圖、類別圖 | `apps/web/src/ui/useReducedMotion.ts` |
| 時間常數（2 秒、3 秒、1 秒） | 類別圖（註記）、時序圖 | `apps/web/src/ui/timing.ts` |
| HomePage | 組件圖 | `apps/web/src/pages/HomePage.tsx`（自 `App.tsx` 抽出） |
| SubmissionBoard（GroupBadge、RankMedal、新送出動態） | 組件圖、時序圖 | `apps/web/src/pages/teacher/SubmissionBoard.tsx`；答案排版抽到 `apps/web/src/components/AnswerLines.tsx` 與 ResultReveal 共用 |
| GroupOverviewPanel／MemberAnswerTags（GroupBadge） | 組件圖 | `apps/web/src/pages/teacher/{GroupOverviewPanel,MemberAnswerTags}.tsx` |
| TeacherLoginPage／TeacherDashboard／ImportPanel／SessionControls／ExportPanel／CsvExportPanel | 組件圖 | `apps/web/src/pages/teacher/*.tsx`（只換樣式；`TeacherDashboard` 另接切換提示、結果揭曉、連線橫幅） |
| NicknamePanel／JoinGroupPanel／PhaseBanner／GroupMemberList | 組件圖、時序圖 | `apps/web/src/pages/student/*.tsx` |
| AnswerSheet／QuestionAnswerForm（送出中、送出成功） | 組件圖、時序圖 | `apps/web/src/pages/student/{AnswerSheet,QuestionAnswerForm}.tsx` |
| StudentResultBoard（獎盃、慶祝） | 組件圖、時序圖 | `apps/web/src/pages/student/StudentResultBoard.tsx`；`StudentPage.tsx` 接切換提示與慶祝 |
| SessionTimer、StatusBadge | 組件圖 | `apps/web/src/components/{SessionTimer,StatusBadge}.tsx` |
| useSessionState／useStudentAuth、shared、伺服器 | 組件圖（灰色） | 沿用，不改 |

## Project Structure

### Documentation (this feature)

```text
specs/007-ui-ux-refresh/
├── spec.md
├── plan.md              # 本檔
├── research.md          # Phase 0
├── data-model.md        # Phase 1（前端呈現用的值，不含伺服器資料）
├── quickstart.md        # Phase 1（含人工驗證步驟）
├── contracts/           # Phase 1
│   ├── ui-visual.md         # 首頁、共用樣式、按鈕、組別識別、階段標示、等待與連線狀態
│   └── ui-effects.md        # 切換提示、送出、計時、名次、新送出動態、慶祝效果、結果揭曉、減少動態
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2（由 /speckit-tasks 產生）

diagrams/
├── 007-ui-ux-refresh-component.puml / .png
├── 007-ui-ux-refresh-class.puml / .png
└── 007-ui-ux-refresh-sequence.puml / .png
```

### Source Code (repository root)

只列出本子功能新增（＋）或修改（～）的檔案；`apps/server`、`packages/shared` 不變：

```text
apps/web/
├── package.json                               ～ 新增 lucide-react、@fontsource-variable/nunito
└── src/
    ├── index.css                              ～ @theme token、背景圖樣、keyframes、.ui-anim 與減少動態規則
    ├── main.tsx                               ～ 匯入 Nunito 字型 CSS
    ├── App.tsx                                ～ 首頁抽出；載入中改用 LoadingState
    ├── ui/
    │   ├── theme.ts                           ＋ GROUP_COLORS、PHASE_COLORS、MEDAL_COLORS
    │   ├── timing.ts                          ＋ PHASE_TOAST_MS 等時間常數
    │   ├── icons.tsx                          ＋ Icon、IconName（組別圖示＋意義圖示）
    │   ├── groupIdentity.ts                   ＋
    │   ├── phaseStyle.ts                      ＋
    │   ├── Button.tsx                         ＋ primary／secondary／danger、處理中
    │   ├── GroupBadge.tsx                     ＋
    │   ├── RankMedal.tsx                      ＋
    │   ├── EmptyState.tsx                     ＋ EmptyState、LoadingState
    │   ├── ConnectionBanner.tsx               ＋ 斷線後恢復時的「已重新連線」；老師端、學生端尚未加入組別時另顯示中斷文字
    │   ├── PhaseTransitionToast.tsx           ＋
    │   ├── Celebration.tsx                    ＋
    │   ├── usePhaseTransition.ts              ＋
    │   ├── useNewSubmissionHighlight.ts       ＋
    │   └── useReducedMotion.ts                ＋
    ├── components/
    │   ├── AnswerLines.tsx                    ＋ 自 SubmissionBoard 抽出，與 ResultReveal 共用
    │   ├── StatusBadge.tsx                    ～ 階段色與圖示
    │   ├── SessionTimer.tsx                   ～ 脈動點與階段色
    │   ├── ErrorBanner.tsx、QuestionContent.tsx、QuestionList.tsx、QuestionPreview.tsx、TimeHint.tsx  ～ 只換樣式
    ├── pages/
    │   ├── HomePage.tsx                       ＋
    │   ├── teacher/ResultReveal.tsx           ＋
    │   ├── teacher/TeacherDashboard.tsx       ～ 切換提示、結果揭曉、連線橫幅、樣式
    │   ├── teacher/SubmissionBoard.tsx        ～ GroupBadge、RankMedal、新送出動態、EmptyState
    │   ├── teacher/GroupOverviewPanel.tsx、MemberAnswerTags.tsx、GroupOverviewToggle.tsx  ～ GroupBadge 與樣式（版面 class 不變）
    │   ├── teacher/TeacherLoginPage.tsx、ImportPanel.tsx、SessionControls.tsx、ExportPanel.tsx、CsvExportPanel.tsx、TeacherPage.tsx  ～ Button 與樣式
    │   ├── student/StudentPage.tsx            ～ 切換提示、慶祝、連線橫幅、LoadingState
    │   ├── student/PhaseBanner.tsx            ～ 本組顏色頂端列、階段標籤、醒目的連線中斷膠囊（文字留在此元件）
    │   ├── student/JoinGroupPanel.tsx         ～ 組別色按鈕、EmptyState
    │   ├── student/GroupMemberList.tsx        ～ 標題列 GroupBadge、本組顏色邊條
    │   ├── student/AnswerSheet.tsx、QuestionAnswerForm.tsx  ～ 等待狀態、送出中、送出成功標記
    │   ├── student/StudentResultBoard.tsx     ～ 獎盃、GroupBadge
    │   └── student/NicknamePanel.tsx          ～ Button 與樣式
apps/web/tests/
├── contrast.ts                                ＋ WCAG 對比計算（測試輔助）
├── theme.test.ts                              ＋ 色票與 index.css 語意色的對比、意義圖示不重複、階段樣式不重複
├── groupIdentity.test.ts                      ＋ 1～20 組 (color, icon) 兩兩不同
├── GroupBadge.test.tsx                        ＋
├── StatusBadge.test.tsx                       ＋
├── EmptyState.test.tsx                        ＋
├── usePhaseTransition.test.tsx                ＋
├── useNewSubmissionHighlight.test.tsx         ＋
├── useReducedMotion.test.tsx                  ＋
├── PhaseTransitionToast.test.tsx              ＋
├── Celebration.test.tsx                       ＋（含 StudentPage 整合：當場結束才播放）
├── ResultReveal.test.tsx                      ＋（含 TeacherDashboard 整合：當場結束才出現）
├── ConnectionBanner.test.tsx                  ＋
├── HomePage.test.tsx                          ＋
├── Button.test.tsx                            ＋
├── offlineAssets.test.ts                      ＋ index.html、index.css 不引用外部網址
├── SubmissionBoard.test.tsx                   ～ 金銀銅、GroupBadge、新送出動態
├── GroupOverviewPanel.test.tsx                ～ 「不在組內」樣式斷言改為新樣式（語意不變）
├── PhaseBanner、GroupMemberList、JoinGroupPanel、StudentPage、TeacherDashboard、QuestionAnswerForm、
│   SessionTimer、StudentResultBoard、AnswerSheet 的 .test.tsx   ～ 只新增案例，既有斷言不變
└── 其他既有測試                                 不改
```

**Structure Decision**: 沿用既有的 monorepo，只動 `apps/web`。跨畫面共用的視覺元件、色票與效果 hook 放在新的
`apps/web/src/ui/`（對應組件圖的「ui」package），與既有的 `components/`（領域相關的共用元件，如題目內容、計時）分開；
頁面只透過 `ui/` 取用圖示與顏色，不直接匯入 lucide 或寫死色碼，讓 FR-006「同一意義同一圖示」與對比檢查集中在一處。

## Complexity Tracking

Constitution Check 沒有違反項目，不需填寫。
