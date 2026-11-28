import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUP_ICON_NAMES, MEANING_ICON_NAMES, iconComponent } from '../src/ui/icons';
import { SESSION_STATUS_LABEL, type SessionStatus } from '@crs/shared';
import { phaseStyle } from '../src/ui/phaseStyle';
import { GROUP_COLORS, MEDAL_COLORS, ON_COLOR, PHASE_COLORS } from '../src/ui/theme';
import { contrastRatio, oklchToHex } from './contrast';

const WHITE = '#ffffff';

/** 讀取 index.css 的 @theme 靜態語意色（tasks T013 規定一律寫成 6 位 hex）。 */
function cssColors(): Map<string, string> {
  const css = readFileSync(resolve(import.meta.dirname, '../src/index.css'), 'utf8');
  const colors = new Map<string, string>();
  for (const match of css.matchAll(/--color-([a-z-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    const [, name, hex] = match;
    if (name !== undefined && hex !== undefined) colors.set(name, hex);
  }
  return colors;
}

function cssColor(name: string): string {
  const hex = cssColors().get(name);
  if (hex === undefined) throw new Error(`index.css 沒有定義 --color-${name}`);
  return hex;
}

describe('色票對比（FR-024、SC-006）', () => {
  it('組別色共 10 色、兩兩不同，每色放白字的對比 ≥ 4.5', () => {
    expect(GROUP_COLORS).toHaveLength(10);
    expect(new Set(GROUP_COLORS).size).toBe(10);
    for (const color of GROUP_COLORS) {
      expect(contrastRatio(color, ON_COLOR), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('階段色四色兩兩不同，放在白底的對比 ≥ 4.5', () => {
    const colors = Object.values(PHASE_COLORS);
    expect(new Set(colors).size).toBe(4);
    for (const color of colors) {
      expect(contrastRatio(color, WHITE), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('金銀銅放在白底的對比 ≥ 4.5', () => {
    for (const color of Object.values(MEDAL_COLORS)) {
      expect(contrastRatio(color, WHITE), color).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('index.css 的內文、次要文字在頁面與卡片底色上 ≥ 4.5', () => {
    for (const text of ['ink', 'ink-muted']) {
      for (const background of ['page', 'card']) {
        expect(
          contrastRatio(cssColor(text), cssColor(background)),
          `${text} / ${background}`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('白字在主要、危險按鈕上 ≥ 4.5；次要按鈕字在卡片上 ≥ 4.5', () => {
    expect(contrastRatio(WHITE, cssColor('primary'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(WHITE, cssColor('danger'))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(cssColor('secondary-ink'), cssColor('card'))).toBeGreaterThanOrEqual(4.5);
  });
});

/** Tailwind 4 預設調色盤（node_modules/tailwindcss/theme.css）中的顏色，例如 `green-800` → `#rrggbb`。 */
function tailwindColor(name: string): string {
  const require = createRequire(resolve(import.meta.dirname, 'theme.test.ts'));
  const css = readFileSync(require.resolve('tailwindcss/theme.css'), 'utf8');
  const match = new RegExp(`--color-${name}:\\s*(oklch\\([^)]*\\))`).exec(css);
  if (match?.[1] === undefined) throw new Error(`tailwindcss/theme.css 沒有 --color-${name}`);
  return oklchToHex(match[1]);
}

/** 顏色名稱：index.css 的 token 用 `token:` 前綴，其餘為 Tailwind 調色盤名稱或 #hex */
function colorOf(name: string): string {
  if (name.startsWith('#')) return name;
  if (name.startsWith('token:')) return cssColor(name.slice('token:'.length));
  return tailwindColor(name);
}

/**
 * 頁面直接使用 Tailwind 調色盤 class 的「文字色／背景色」組合（research R1 允許的範圍）。
 * 新增這類組合時要一併加進這張表，讓對比維持自動檢查（FR-024、SC-006）。
 */
const PALETTE_TEXT_PAIRS: readonly { text: string; bg: string; where: string }[] = [
  {
    text: 'green-800',
    bg: '#ffffff',
    where: '成功訊息、送出列表搶答成功（styles SUCCESS_TEXT、SubmissionBoard）',
  },
  {
    text: 'green-800',
    bg: 'green-100',
    where: '送出成功標記、學生結果「搶答成功」（QuestionAnswerForm、StudentResultBoard）',
  },
  { text: 'green-800', bg: 'green-50', where: '已送出的題號（AnswerSheet）' },
  { text: 'green-800', bg: '#fef08a', where: '新送出滑入時短暫亮起的底色（index.css slide-in）' },
  { text: 'green-900', bg: '#ffffff', where: '送出列表搶答成功的答案（SubmissionBoard）' },
  { text: 'token:ink', bg: '#fef08a', where: '新送出滑入時短暫亮起的底色（index.css slide-in）' },
  { text: 'amber-800', bg: '#ffffff', where: '待開始時重新匯入提示（ImportPanel）' },
  { text: 'amber-800', bg: 'amber-50', where: '老師身分提示（StudentPage）' },
  { text: 'amber-800', bg: 'amber-100', where: '學生結果標籤（StudentResultBoard）' },
  {
    text: 'amber-900',
    bg: 'amber-50',
    where: '失效訊息、未送出提示（JoinGroupPanel、StudentResultBoard）',
  },
  {
    text: 'amber-900',
    bg: 'amber-100',
    where: '時間提示、搶答成功標籤（QuestionList、SubmissionBoard、MemberAnswerTags）',
  },
  {
    text: 'red-800',
    bg: 'red-50',
    where: '錯誤訊息（ErrorBanner、JoinGroupPanel、NicknamePanel、StudentPage）',
  },
  { text: 'red-700', bg: '#ffffff', where: '作答欄錯誤（QuestionAnswerForm）' },
  { text: '#ffffff', bg: 'red-700', where: '連線中斷膠囊與橫幅（PhaseBanner、ConnectionBanner）' },
  { text: '#ffffff', bg: 'green-700', where: '「已重新連線」橫幅（ConnectionBanner）' },
  { text: 'slate-600', bg: 'slate-100', where: '學生結果「未作答」標籤（StudentResultBoard）' },
  {
    text: 'slate-500',
    bg: '#ffffff',
    where: '「不在組內」、結果說明（GroupOverviewPanel、StudentResultBoard）',
  },
  { text: 'token:ink', bg: 'slate-100', where: '組員名單（GroupMemberList）' },
  {
    text: 'violet-800',
    bg: 'violet-100',
    where: '題組／子題標籤（QuestionContent、AnswerSheet、SubmissionBoard）',
  },
  {
    text: 'violet-900',
    bg: 'violet-50',
    where: '目前預覽的題號、回答標籤（QuestionList、MemberAnswerTags）',
  },
  { text: 'violet-900', bg: 'violet-100', where: '組員名單中的自己（GroupMemberList）' },
  { text: 'orange-700', bg: '#ffffff', where: '分組情況「連線中斷」（GroupOverviewPanel）' },
  { text: 'token:ink-muted', bg: 'violet-50', where: '等待與空白狀態（EmptyState）' },
];

/** 只是圖示（大字與圖示 ≥ 3:1）的調色盤組合 */
const PALETTE_ICON_PAIRS: readonly { icon: string; bg: string; where: string }[] = [
  { icon: 'amber-600', bg: '#ffffff', where: '學生結果的獎盃圖示（StudentResultBoard）' },
  { icon: 'token:primary', bg: 'violet-100', where: '區塊標題圖示（SectionHeading）' },
];

describe('頁面直接使用的 Tailwind 調色盤（007 T089、FR-024、SC-006）', () => {
  it('oklch 轉換與 Tailwind 的 hex 對照一致（white、black 端點）', () => {
    expect(oklchToHex('oklch(100% 0 0)')).toBe('#ffffff');
    expect(oklchToHex('oklch(0% 0 0)')).toBe('#000000');
  });

  it.each(PALETTE_TEXT_PAIRS)('文字 $text 在 $bg 上 ≥ 4.5（$where）', ({ text, bg }) => {
    expect(contrastRatio(colorOf(text), colorOf(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(PALETTE_ICON_PAIRS)('圖示 $icon 在 $bg 上 ≥ 3（$where）', ({ icon, bg }) => {
    expect(contrastRatio(colorOf(icon), colorOf(bg))).toBeGreaterThanOrEqual(3);
  });
});

/** apps/web/src 底下所有 .ts／.tsx 檔（相對路徑） */
function sourceFiles(dir = resolve(import.meta.dirname, '../src')): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('不寫死色碼（007 plan：頁面只透過 ui/ 取用顏色）', () => {
  it('除了 ui/theme.ts 之外，原始碼沒有 #hex 色碼', () => {
    const root = resolve(import.meta.dirname, '../src');
    const offenders = sourceFiles()
      .filter((path) => relative(root, path) !== join('ui', 'theme.ts'))
      .filter((path) => /#[0-9a-fA-F]{3,6}\b/.test(readFileSync(path, 'utf8')))
      .map((path) => relative(root, path));
    expect(offenders).toEqual([]);
  });
});

describe('圖示（FR-006、FR-008）', () => {
  it('組別圖示共 20 個且兩兩不同', () => {
    expect(GROUP_ICON_NAMES).toHaveLength(20);
    expect(new Set(GROUP_ICON_NAMES.map(iconComponent)).size).toBe(20);
  });

  it('組別圖示不使用保留給意義的圖形', () => {
    const meaning = new Set(MEANING_ICON_NAMES.map(iconComponent));
    for (const name of GROUP_ICON_NAMES) {
      expect(meaning.has(iconComponent(name)), name).toBe(false);
    }
  });
});

describe('階段樣式（007 data-model §2，FR-010、SC-002）', () => {
  const STATUSES: SessionStatus[] = ['NOT_IMPORTED', 'READY', 'OPEN', 'CLOSED'];

  it('四個階段的顏色與圖示兩兩不同，文字沿用既有階段文字', () => {
    const styles = STATUSES.map(phaseStyle);
    expect(new Set(styles.map((s) => s.color)).size).toBe(4);
    expect(new Set(styles.map((s) => s.icon)).size).toBe(4);
    for (const [i, status] of STATUSES.entries()) {
      expect(styles[i]?.label).toBe(SESSION_STATUS_LABEL[status]);
      expect(styles[i]?.color).toBe(PHASE_COLORS[status]);
      expect(styles[i]?.status).toBe(status);
    }
  });
});
