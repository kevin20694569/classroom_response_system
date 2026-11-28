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

/** 線性 sRGB（0～1，超出色域時截斷）→ `#rrggbb` */
function linearToHex(channels: readonly number[]): string {
  return `#${channels
    .map((linear) => {
      const c = Math.min(1, Math.max(0, linear));
      const srgb = c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;
      return Math.round(srgb * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('')}`;
}

/**
 * 把 Tailwind 4 調色盤的 `oklch(L% C H)` 轉成 `#rrggbb`（OKLab → 線性 sRGB，Björn Ottosson 的公式），
 * 讓頁面直接使用的調色盤 class 也能用 contrastRatio 檢查（007 T089）。
 */
export function oklchToHex(value: string): string {
  const match = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/.exec(value.trim());
  if (match === null) throw new Error(`不是 oklch(L% C H) 格式的顏色：${value}`);
  const [, lPercent, chroma, hue] = match;
  const L = Number(lPercent) / 100;
  const h = (Number(hue) * Math.PI) / 180;
  const a = Number(chroma) * Math.cos(h);
  const b = Number(chroma) * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return linearToHex([
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]);
}
