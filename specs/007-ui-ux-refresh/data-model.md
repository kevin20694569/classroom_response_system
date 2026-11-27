# Data Model：介面視覺與互動體驗改版

**Feature**: `007-ui-ux-refresh` | **Plan**: [plan.md](./plan.md) | **Research**: [research.md](./research.md)

本子功能**不新增、不修改**任何伺服器資料、共用契約（`packages/shared`）或保存格式。以下都是前端呈現用的值，
由伺服器既有推播的資料（`SessionView`）即時推得，不儲存、不送回伺服器。對應類別圖
[`diagrams/007-ui-ux-refresh-class.puml`](../../diagrams/007-ui-ux-refresh-class.puml)。

## 1. GroupIdentity（組別識別）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `groupId` | `GroupId`（1～20） | 沿用共用契約 |
| `color` | hex 字串 | `GROUP_COLORS[(groupId − 1) mod 10]`（research R2） |
| `icon` | `GroupIconName` | `GROUP_ICONS[groupId − 1]` |
| `name` | string | 沿用 `groupName(groupId)`，即「第 N 組」 |

**規則**

- 由 `groupIdentity(groupId)` 純函式產生，同一 `groupId` 永遠得到相同結果（FR-007）。
- 1～20 任兩組的 `(color, icon)` 不相同（FR-008）；因 `GROUP_ICONS` 20 個兩兩不同而成立。
- `color` 對白字的對比 ≥ 4.5:1（FR-024）。
- 顯示時一律搭配 `name`；圖示 `aria-hidden`，朗讀名稱只有「第 N 組」（FR-007）。

## 2. PhaseStyle（階段樣式）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `status` | `SessionStatus` | 沿用共用契約 |
| `label` | string | 沿用 `SESSION_STATUS_LABEL[status]`（既有文字不變） |
| `color` | hex 字串 | 階段強調色（research R7），對白底 ≥ 4.5:1 |
| `icon` | `MeaningIconName` | FileUp／Hourglass／Timer／Flag |

**規則**：四個階段的 `color` 兩兩不同、`icon` 兩兩不同（FR-010、SC-002）。由 `phaseStyle(status)` 產生。

## 3. PhaseTransition（階段變化）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `from` | `SessionStatus` | 本分頁上一次看到的階段 |
| `to` | `SessionStatus` | 新階段 |
| `text` | `'搶答開始！' \| '搶答結束' \| null` | 只有 READY→OPEN、OPEN→CLOSED 有提示文字 |
| `key` | number | 每次變化遞增；新的提示以新的 key 取代舊提示 |

**產生規則**（`usePhaseTransition(view, connected)`，research R6）：以伺服器每次推來的 view 物件為單位判斷——
重新連線時 `connected` 先變回 true，但畫面上的 view 還是斷線前那一份；要等伺服器送來新的 view，才建立 baseline。

```text
            ┌──────────────────────────────┐
            │ 需要 baseline（初始狀態）      │
            └──────────────┬───────────────┘
   收到新的 view（非 null）  │  記下 baseline，不產生變化
                           ▼
            ┌──────────────────────────────┐
            │ 已有 baseline                 │◀───────────────┐
            └──┬───────────────┬───────────┘                │
               │ 新的 view 且 status ≠ baseline                           │
               │  → 產生 PhaseTransition，更新 baseline ───────┘
               │
               │ view 為 null，或 connected 變為 false
               ▼
            回到「需要 baseline」
```

- 首次載入、重新整理（重新掛載）、斷線重連、加入／離開組別（身分改變時 status 暫為 null）之後的第一份資料只建立 baseline，
  **不**產生變化（FR-014、FR-019、FR-029）。
- 只存在於元件的記憶中（`useRef`），不寫入 `sessionStorage`／`localStorage`。

## 4. 由階段變化觸發的效果

| 效果 | 觸發條件 | 開始 | 持續 | 減少動態效果時 |
|------|----------|------|------|----------------|
| 切換提示（老師端、學生端） | `transition.text !== null` | 立即 | `PHASE_TOAST_MS` = 1.8 秒 | 靜態出現、同樣時間後消失 |
| 慶祝效果（學生端） | `transition.to === 'CLOSED'` 且本組 `wonCount > 0` | 提示消失後 | `CELEBRATION_MS` = 2.8 秒 | 不播放 |
| 結果揭曉（老師端） | `transition.to === 'CLOSED'` | 提示消失後 | 直到老師按「關閉」或 Esc | 靜態出現 |

- 新的變化（新 key）會取消尚未開始的慶祝效果與揭曉計時器。
- 結果揭曉在 `status !== 'CLOSED'` 或 `activityId` 改變時自動關閉。

## 5. NewSubmissionMarks（老師端新送出）

| 欄位 | 型別 | 說明 |
|------|------|------|
| `seen` | `Set<Submission.id>` | 第一份資料（含重連後第一份）中的所有送出 |
| `fresh` | `Set<Submission.id>` | 之後才出現的送出；對應的列套用滑入亮起動畫（≤ 0.9 秒） |

規則同 §3 的 baseline（`useNewSubmissionHighlight(submissions, connected)`，以伺服器推來的送出陣列為單位）：`connected` 變為 `false` 時，下一份新資料的送出全部視為已看過（FR-030）。

## 6. 主題 token（不屬於資料，列出以便對照）

- `GROUP_COLORS`（10 色）、`GROUP_ICONS`（20 個）、`PHASE_COLORS`（4 色）、`MEDAL_COLORS`（金銀銅）：
  `apps/web/src/ui/theme.ts`。
- 背景、卡片、圓角、陰影、字型、keyframes：`apps/web/src/index.css` 的 `@theme`。
- 時間常數：`apps/web/src/ui/timing.ts`。
