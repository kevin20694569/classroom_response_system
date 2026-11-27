/**
 * WCAG 2 對比計算（007 FR-024、SC-006；tasks T004）：只給測試使用，讓色票的對比要求成為自動化檢查。
 */

/** 解析 `#rrggbb`；格式不符時丟出錯誤，避免測試在錯誤輸入上誤判為通過。 */
function channels(hex: string): [number, number, number] {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (match === null) throw new Error(`不是 #rrggbb 格式的顏色：${hex}`);
  const [, r, g, b] = match;
  return [Number.parseInt(r ?? '', 16), Number.parseInt(g ?? '', 16), Number.parseInt(b ?? '', 16)];
}

/** 相對亮度：sRGB 通道 ≤ 0.03928 時 ÷ 12.92，否則 ((c + 0.055) ÷ 1.055)^2.4；L = 0.2126R + 0.7152G + 0.0722B。 */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = channels(hex).map((value) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 對比 = (較亮 L + 0.05) ÷ (較暗 L + 0.05)，與參數順序無關。 */
export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}
