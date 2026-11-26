import { CSV_HEADERS } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { encodeCsv, encodeField, toExcelText } from '../../src/domain/export/csv/csvEncoder.js';

const row = ['1', null, '第 1 組', '小明', '答案', '第 1 名', '2026/11/23 08:00:01.000', '是'];

describe('encodeCsv（基本結構，contracts/csv-format.md §1）', () => {
  const text = encodeCsv(CSV_HEADERS, [row, row]);

  it('以 UTF-8 BOM 開頭（FR-011）', () => {
    expect(text.charCodeAt(0)).toBe(0xfeff);
  });

  it('第一列為表頭，每列（含最後一列）以 CRLF 結束', () => {
    const lines = text.slice(1).split('\r\n');
    expect(lines[0]).toBe(CSV_HEADERS.join(','));
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('');
    expect(text.endsWith('\r\n')).toBe(true);
  });

  it('每列 8 欄，null 輸出空字串', () => {
    const lines = text.slice(1).split('\r\n').slice(0, 3);
    for (const line of lines) expect(line.split(',')).toHaveLength(8);
    expect(lines[1]?.split(',')[1]).toBe('');
  });

  it('沒有資料列時只有 BOM 與表頭', () => {
    expect(encodeCsv(CSV_HEADERS, [])).toBe(`\uFEFF${CSV_HEADERS.join(',')}\r\n`);
  });
});

describe('encodeField（引號與公式防護，contracts/csv-format.md §2）', () => {
  it.each([
    ['甲', '甲'],
    ['蘋果, 香蕉', '"蘋果, 香蕉"'],
    ['他說"好"', '"他說""好"""'],
    ['第一行\n第二行', '"第一行\n第二行"'],
    ['第一行\r第二行', '"第一行\r第二行"'],
    ['=1+1', "'=1+1"],
    ['-abc', "'-abc"],
    ['+x', "'+x"],
    ['@A', "'@A"],
    ['\t縮排', "'\t縮排"],
    ['=SUM(A1, B1)', `"'=SUM(A1, B1)"`],
    [' 前後空白 ', '" 前後空白 "'],
    ['A,B', '"A,B"'],
    ['a=b', 'a=b'],
    ['蘋果🍎 こんにちは', '蘋果🍎 こんにちは'],
  ])('%j → %j', (input, expected) => {
    expect(encodeField(input)).toBe(expected);
  });

  it('null 輸出空字串', () => {
    expect(encodeField(null)).toBe('');
  });
});

describe('toExcelText（Excel 會轉換的答案與暱稱，顯示原樣）', () => {
  it.each([
    '007',
    '1/2',
    '1-2',
    '3:30',
    '1e5',
    '1,000',
    '0.50',
    '-5',
    '+3',
    '12345678901234567890',
    '50%',
    'TRUE',
    'false',
  ])('%j 以 ="…" 輸出，Excel 開啟後顯示原樣', (input) => {
    const cell = toExcelText(input);
    expect(cell).toEqual({ excelText: input });
    expect(encodeField(cell)).toBe(`"=""${input}"""`);
  });

  it.each(['甲', 'CPU', '3 apples', 'GPU2', '=1+1', '(1)', '第1題', '', ' '])(
    '%j 不需要處理，原樣交給 encodeField',
    (input) => {
      expect(toExcelText(input)).toBe(input);
    },
  );

  it('null 維持 null', () => {
    expect(toExcelText(null)).toBeNull();
  });

  it('encodeCsv 對 ExcelTextCell 與一般值混合輸出', () => {
    const text = encodeCsv(['a', 'b'], [[{ excelText: '007' }, '=1+1']]);
    expect(text.slice(1)).toBe('a,b\r\n"=""007""",\'=1+1\r\n');
  });
});
