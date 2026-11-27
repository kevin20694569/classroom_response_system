import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUP_ICON_NAMES, MEANING_ICON_NAMES, iconComponent } from '../src/ui/icons';
import { GROUP_COLORS, MEDAL_COLORS, ON_COLOR, PHASE_COLORS } from '../src/ui/theme';
import { contrastRatio } from './contrast';

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
