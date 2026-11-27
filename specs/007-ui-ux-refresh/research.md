# Research：介面視覺與互動體驗改版

**Feature**: `007-ui-ux-refresh` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

本子功能只改前端呈現。以下記錄 plan 階段需要決定的事項；每一項列出決定、理由與考慮過的其他做法。

## 現況基準（2026-11-28 量測）

- 樣式：`apps/web/src/index.css` 只有 `@import 'tailwindcss'`，所有畫面使用 Tailwind 預設色（slate、indigo 為主）。
- 建置大小（`vite build`）：主程式 `index-*.js` 392.22 kB（gzip 120.77 kB）、學生端延遲載入 `StudentPage-*.js`
  433.28 kB（gzip 162.42 kB）、CSS 21.08 kB（gzip 4.93 kB）。
- 前端測試 37 個檔案，以文字、role、aria-label 查詢為主；少數測試檢查 class（版面：`TeacherDashboard`、
  `GroupOverviewPanel`；換行：`break-words`、`whitespace-pre-wrap`；顏色：`GroupOverviewPanel` 的 `text-slate-400`）。

---

## R1 視覺主題的定義方式

**Decision**：分成兩個來源，各自是唯一來源：

1. **CSS 主題（`apps/web/src/index.css`）**：以 Tailwind 4 的 `@theme` 定義全站共用的 token：靜態語意色（`--color-page`、
   `--color-card`、`--color-ink`、`--color-ink-muted`、`--color-primary`、`--color-secondary-ink`、`--color-danger`，一律寫成
   6 位 hex，讓測試可以解析並計算對比）、頁面背景色調與淡圖樣、
   卡片圓角與陰影、字型、動畫 keyframes（`pop-in`、`slide-in`、`pulse-dot`、`confetti-fall`、`float`），以及一段
   `@media (prefers-reduced-motion: reduce)` 規則停用所有 `.ui-anim` 動畫。
2. **TypeScript 色票（`apps/web/src/ui/theme.ts`）**：組別色、階段色、金銀銅色等「會依資料切換」的顏色以 hex 字串
   定義，元件以 inline style（CSS 變數 `--group-color`、`--phase-color`）套用。

**Rationale**：依組別編號、活動階段動態切換的顏色若寫成 Tailwind class，需要在原始碼中列出所有可能 class 才會被產生；
用 TS 常數＋CSS 變數則沒有這個問題。更重要的是 FR-024 的對比要求可以在單元測試中直接用這份色票計算（R9），
讓「對比合格」成為自動化測試，而不是只靠人工目測。

**Alternatives considered**：

- 全部寫成 Tailwind class 並 safelist：對比無法自動檢查，class 清單與色票會分成兩份。
- 引入 CSS-in-JS 或元件庫（Chakra、MUI）：新增大量相依與學習成本，與現有 Tailwind 寫法衝突，違反「只在已知需要時抽象」。

## R2 組別識別的配色與圖示

**Decision**：10 種組別色 × 20 個組別圖示。第 n 組（1 ≤ n ≤ 20）：

- 顏色 = `GROUP_COLORS[(n − 1) mod 10]`
- 圖示 = `GROUP_ICONS[n − 1]`（20 個互不相同的圖示）

因為圖示兩兩不同，任兩組的「顏色＋圖示」組合必然不同（FR-008）；第 1 組與第 11 組同色但圖示不同。

| 色名 | hex | 白字對比 |
|------|-----|----------|
| rose | `#be123c` | 6.29 |
| orange | `#c2410c` | 5.18 |
| amber | `#b45309` | 5.02 |
| lime | `#4d7c0f` | 4.99 |
| emerald | `#047857` | 5.48 |
| teal | `#0f766e` | 5.47 |
| cyan | `#0e7490` | 5.36 |
| blue | `#1d4ed8` | 6.70 |
| violet | `#6d28d9` | 7.10 |
| fuchsia | `#a21caf` | 6.32 |

組別圖示（lucide 圖示名稱，依組別編號）：Rocket、Star、Flame、Zap、Leaf、Fish、Bird、Cat、Dog、Rabbit、Sun、Moon、
Cloud、Anchor、Crown、Gem、Heart、Guitar、Flower2、Snowflake。刻意避開 R7 保留給「意義」的圖示（獎盃、獎牌、勾勾、
時鐘、警告），避免「第 N 組的圖示」和「搶答成功」混淆（FR-006）。實作時若某個名稱在選定的圖示套件版本中不存在，
以同類圖示替換並更新本表（lucide-react 1.82.0 沒有 Music 與 CircleAlert，已分別換成 Guitar 與 CircleExclamationPoint）。

**Rationale**：所有組別色都以白字達到 4.5:1（上表以 WCAG 相對亮度公式計算），頂端列（FR-009a）、選組按鈕、徽章都可以
用「組別色底＋白字」。10 種色相彼此差異明顯；超過 10 組時由圖示區分，符合「顏色不是唯一辨識方式」（FR-008）。

**Alternatives considered**：

- 20 種不同顏色：相鄰色相難以分辨，且很難全部對白字達 4.5:1。
- 圖示依顏色循環、顏色固定 20 種：同上。
- 使用 emoji 當圖示：各作業系統顯示不同（Windows 與 macOS 差異大），無法保證外觀一致與對比，也無法控制顏色。

## R3 圖示來源

**Decision**：新增相依套件 `lucide-react`（`1.82.0`，ISC 授權，2026-11-27 仍有發布），只以具名匯入使用需要的圖示；
以 `apps/web/src/ui/icons.tsx` 的 `Icon` 元件包裝，對外只暴露 `IconName`（組別圖示 20 個＋意義圖示），頁面不直接匯入
lucide。所有圖示 `aria-hidden="true"`（FR-007：螢幕閱讀器不朗讀圖示）。

**Rationale**：圖示以 SVG 打包進程式，離線也能顯示（FR-026）；具名匯入可 tree-shake，約 30 個圖示只增加數 kB。
套件持續維護，符合憲章「MUST NOT 使用已停止維護的套件」。包一層 `Icon` 讓 FR-006「同一意義同一圖示」集中在一個對照表。

**Alternatives considered**：

- 自己畫 SVG：30 個圖示的繪製與一致性成本高。
- 圖示字型（Font Awesome 字型檔）：整包字型較大，無法 tree-shake。
- `react-icons`：打包多套圖示庫，風格不一致，套件體積大。

## R4 字型

**Decision**：

- 中文：使用系統字型堆疊 `"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif`，不打包中文字型。
- 英數字（標題、數字、計時、英文暱稱）：新增 `@fontsource-variable/nunito`（`5.3.0`，OFL-1.1，2026-07 仍有發布），
  匯入套件預設的 CSS（即 wght 可變字型）；Vite 會把 woff2 打包成本機資源，各語系子集以 `unicode-range` 分開，瀏覽器只下載用到的子集。
- 字型堆疊為 `"Nunito Variable", <中文系統字型堆疊>`：英數字用 Nunito，中文自動落到系統字型。

**Rationale**：圓體英數字（Nunito）明顯帶出「活潑遊戲感」（FR-002），尤其是計時與名次數字；latin 子集只有數十 kB。
中文字型檔動輒數 MB，打包會讓首頁明顯變慢（違反 Assumptions 的載入要求），而 macOS／Windows 都內建可讀的繁中字型。
字型隨系統提供或打包在程式內，都不需要網際網路（FR-026、SC-008）。

**Alternatives considered**：

- 打包 Noto Sans TC 子集：即使子集化仍有數百 kB，且要維護子集字表。
- 從 Google Fonts CDN 載入：違反離線需求（FR-026）。
- 完全不加字型：英數字維持系統字，活潑感不足。

## R5 動畫與慶祝效果

**Decision**：

- 一般動畫（切換提示彈出、新送出滑入、送出成功打勾、等待中漂浮、計時脈動點）全部用 CSS keyframes，定義在
  `index.css`，元件加 `ui-anim` class。`@media (prefers-reduced-motion: reduce)` 把 `.ui-anim` 的 `animation` 設為
  `none`（FR-023）。
- 慶祝效果自己實作：`Celebration` 元件產生約 40 個彩色紙片 `<span>`（顏色取自組別色票），以 CSS `confetti-fall`
  動畫落下；外層 `position: fixed; inset: 0; pointer-events: none; aria-hidden="true"`，不攔截點擊與捲動（FR-019）。
  是否播放由 JS 決定：`useReducedMotion()` 為 true 時不渲染（FR-023「慶祝效果不播放」）。
- 不新增動畫函式庫。

**Rationale**：所有動畫都是「出現一次」或「循環」，CSS 足夠；CSS 動畫不佔用 React 重新渲染，不會拖慢送出（FR-028）。
慶祝效果需要的只是落下的紙片，自己寫約 40 行，DOM 元素可以直接在測試中檢查存在與消失。

**Alternatives considered**：

- `motion`（Framer Motion，14.x）：功能完整但主程式會增加數十 kB，本子功能用不到它的手勢與版面動畫。
- `canvas-confetti`（1.9.4）：效果好，但以 canvas 繪製，測試只能 mock；且與「減少動態」的整合要另外處理。

## R6 階段變化的判斷（切換提示、慶祝效果、結果揭曉共用）

**Decision**：新增 `usePhaseTransition(view, connected)`，回傳 `PhaseTransition | null`（以伺服器推來的 view 物件為單位，實作時由原本的 `status` 參數調整而來，見下方 Rationale）：

- 以 `useRef` 保存「本分頁上一次看到的階段」（baseline）與「是否需要重新建立 baseline」。
- `status` 為 `null`（尚未連線、身分剛改變而顯示「連線中…」）或 `connected` 變為 `false` 時，標記需要重新建立 baseline。
- 收到新的 view（物件不同）時：若需要重新建立 baseline，只記下 baseline、不觸發（FR-014、FR-019、FR-029）；否則若與 baseline
  不同，產生 `{ from, to, text, key }` 並更新 baseline。`key` 每次遞增，讓新的提示取代尚未消失的舊提示（不排隊）。
- 只有 `READY → OPEN`（「搶答開始！」）與 `OPEN → CLOSED`（「搶答結束」）會產生提示文字；其他變化（如重新匯入的
  `CLOSED → READY`）只更新 baseline。

**Rationale**：`useSessionState` 在重新連線時會保留舊的 view，直到伺服器送來新的完整狀態（`session:state`）；`connect` 事件只把 `connected` 改回 true，view 物件不變。若只看 status，重連後階段沒變時 baseline 永遠建立不起來，下一次真正的變化會被吞掉；以 view 物件為單位就沒有這個問題。如果只比較
「前後兩份 view 的階段」，斷線期間老師結束搶答的情況會在重連後被誤判為「當場看到結束」。以 `connected` 標記重新建立
baseline，正好符合 clarify 的統一規則「只有當場看到階段改變才出現」，而且不需要任何儲存（Key Entities「階段變化」）。

**Alternatives considered**：

- `sessionStorage` 記錄每個效果是否播過：第三次 clarify 決定不用；而且無法分辨「當場」與「重連後」。
- 在伺服器推播中加入「階段剛改變」旗標：違反「伺服器資料不變」（FR-027），也無法處理多分頁。

## R7 意義圖示與名次標示

**Decision**：`IconName` 中保留給「意義」的圖示（FR-006）：

| 意義 | 圖示 |
|------|------|
| 尚未匯入 | FileUp |
| 待開始 | Hourglass |
| 搶答進行中 | Timer |
| 已結束 | Flag |
| 送出成功 | CircleCheck |
| 搶答成功 | Trophy |
| 第 1～3 名 | Medal（金 `#a16207`、銀 `#64748b`、銅 `#9a3412`，對白底皆 ≥ 4.5:1） |
| 等待中 | Hourglass |
| 連線中斷 | WifiOff；已重新連線 Wifi |
| 錯誤 | CircleExclamationPoint |

階段強調色（對白底皆 ≥ 4.5:1）：尚未匯入 `#475569`（7.58）、待開始 `#b45309`（5.02）、搶答進行中 `#15803d`（5.02）、
已結束 `#4338ca`（7.90）。四個階段顏色與圖示兩兩不同（SC-002）。學生端頂端列為組別色底時，階段標籤是「白底＋階段色字
與圖示」的膠囊，文字對比以白底計算（FR-011）。

**Rationale**：意義圖示集中在一處，避免不同畫面用不同圖示表示同一件事；金銀銅以「Medal 圖示＋顏色＋『第 N 名』文字」
同時表達，色弱也能分辨（Edge Cases）。

## R8 老師端新送出動態與結果揭曉

**Decision**：

- `useNewSubmissionHighlight(submissions, connected)`：與 R6 相同的 baseline 規則，第一份資料（首次載入、重新整理、
  重連）中的送出全部視為「已看過」；之後新出現的 id 標記為新送出，該 `<li>` 掛上 `ui-anim animate-slide-in` 與短暫亮起
  的背景（CSS 動畫 0.9 秒，FR-030「1 秒內結束」）。同一次推播帶來的多筆一起標記，不排隊。
- `ResultReveal`（老師端）：當 `usePhaseTransition` 回傳 `to = CLOSED` 時，等切換提示消失（`PHASE_TOAST_MS`）後開啟。
  以 `role="dialog"`、`aria-modal="true"`、標題「結果揭曉」呈現；開啟時焦點移到「關閉」按鈕，按「關閉」或 Esc 關閉。
  內容來自既有的 `TeacherView.results`（`winnerGroupId`、`submitterNickname`、`answers`），答案排版抽出 `SubmissionBoard`
  既有的 `AnswerLines` 共用（FR-029）。`status` 不再是 `CLOSED` 或 `activityId` 改變時自動關閉（Edge Cases）。
- 學生端慶祝效果：`to = CLOSED` 且 `wonCount(...) > 0` 且未設定減少動態時，等 `PHASE_TOAST_MS` 後播放
  `CELEBRATION_MS`。

時間常數集中在 `apps/web/src/ui/timing.ts`：`PHASE_TOAST_MS = 1800`、`CELEBRATION_MS = 2800`、
`NEW_SUBMISSION_HIGHLIGHT_MS = 900`、`RECONNECTED_NOTICE_MS = 2000`。

**Rationale**：揭曉畫面與新送出動態都只用伺服器已經傳給老師的資料，沒有新增可見性（FR-027）。時間常數集中管理，
測試以假時鐘驗證「2 秒內消失」「3 秒內結束」「1 秒內結束」。

## R9 測試策略

**Decision**：

- **純函式單元測試**：`groupIdentity`（2～20 組組合兩兩不同、同一編號固定）、`phaseStyle`（四階段兩兩不同）、
  色票對比（以測試輔助函式 `contrastRatio` 計算：組別色對白字、階段色與金銀銅對白底 ≥ 4.5:1；另解析 `index.css` 的
  `@theme` 靜態語意色，檢查內文、次要文字對頁面與卡片底色、白字對主要與危險按鈕、次要按鈕字對卡片 ≥ 4.5:1，FR-024、SC-006）。
  頁面與元件的文字、按鈕顏色只能使用這些 token 或 `theme.ts` 色票，其餘畫面再以瀏覽器的對比檢查（Lighthouse）人工確認。
- **Hook 測試**：`usePhaseTransition`（首次不觸發、READY→OPEN 觸發、斷線重連不觸發、快速連續切換只留最新）、
  `useNewSubmissionHighlight`、`useReducedMotion`（jsdom 沒有 `matchMedia` 時回傳 false；以既有 `installMatchMedia` 模擬）。
- **元件測試**（假時鐘）：切換提示 ≤ 2 秒消失且 `pointer-events-none`、慶祝效果只在當場結束且本組搶到時出現並 ≤ 3 秒
  消失、結果揭曉內容與關閉、重新整理（重新掛載）不出現、連線中斷與「已重新連線」、首頁入口文字、金銀銅標示。
- **不退化**：既有 37 個測試檔全部保留；它們以文字與 role 查詢，證明既有文字與螢幕閱讀器名稱不變（FR-027、SC-005）。
  檢查版面與換行 class 的既有斷言（`mx-auto`、`max-w-5xl`、`break-words` 等）必須保留這些 class；只有檢查舊配色
  class 的斷言（`GroupOverviewPanel` 的 `text-slate-400`）可以改成檢查新的「不在組內」樣式，語意不變。
- **離線**：新增測試掃描 `index.html` 與 `index.css`，不得出現 `http://`、`https://` 的外部資源（FR-026）。
- **人工驗證**：版面寬度（375～1920 px）、實際動畫觀感、減少動態設定、離線顯示，jsdom 無法計算，列在
  [quickstart.md](./quickstart.md) §5。

**Rationale**：視覺效果本身無法完全自動化，但「何時出現、何時消失、是否擋操作、是否重播、對比是否合格」都是可以用
資料與 DOM 驗證的規則；憲章原則 VII 要求的正常＋邊界案例都落在這些測試上。

## R10 載入大小預算

**Decision**：

- 主程式（老師端與首頁）gzip 不超過 140 kB（基準 120.77 kB）；學生端延遲載入檔 gzip 不超過 180 kB（基準 162.42 kB）。
- 所有 JS 檔維持在 Vite 的 500 kB 警告門檻以下（沿用 004 的做法）。
- 字型檔是獨立資源，不計入上述 JS 預算；Nunito latin 子集 woff2 不超過 60 kB。

**Rationale**：Assumptions 要求新增素材不讓首頁與老師端明顯變慢；具體數字讓 quickstart 可以檢查。預算包含 lucide
約 30 個圖示、新元件與動畫 CSS 的合理增量。

## R11 不改動的部分

- 伺服器、`packages/shared` 的契約與 schema、推播事件、匯入匯出：完全不改（FR-027）。
- 既有文字（按鈕、提示、`aria-label`）：保留原字；新增文字只有 FR-005（首頁）、FR-012（切換提示）、FR-021
  （「已重新連線」）、FR-029（「結果揭曉」「本題無人搶答」「關閉」）。
- 006 的寬窄版面規則（1600 px 門檻、固定框架、抽屜）不變，只換卡片與按鈕樣式（FR-025）。
