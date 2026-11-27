import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/** 007 FR-026：教室可能沒有網路，頁面與主題 CSS 不得引用外部字型、圖示或圖片。 */
describe('不引用外部資源（FR-026）', () => {
  it.each(['../index.html', '../src/index.css'])('%s 不含 http:// 或 https://', (path) => {
    const text = readFileSync(resolve(import.meta.dirname, path), 'utf8');
    expect(text).not.toMatch(/https?:\/\//);
  });
});
