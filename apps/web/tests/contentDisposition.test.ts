import { describe, expect, it } from 'vitest';
import { fileNameFromContentDisposition } from '../src/api/contentDisposition';

describe('fileNameFromContentDisposition', () => {
  it('解出 filename* 的中文檔名', () => {
    const header = `attachment; filename="results_x.csv"; filename*=UTF-8''${encodeURIComponent('搶答結果_20261126-1032.csv')}`;
    expect(fileNameFromContentDisposition(header)).toBe('搶答結果_20261126-1032.csv');
  });

  it('同時有 filename 與 filename* 時優先 filename*', () => {
    const header = `attachment; filename*=UTF-8''%E6%90%B6.csv; filename="ascii.csv"`;
    expect(fileNameFromContentDisposition(header)).toBe('搶.csv');
  });

  it('只有 filename 時回傳它', () => {
    expect(fileNameFromContentDisposition('attachment; filename="results_x.csv"')).toBe(
      'results_x.csv',
    );
  });

  it('null、空字串與格式錯誤時回傳 null', () => {
    expect(fileNameFromContentDisposition(null)).toBeNull();
    expect(fileNameFromContentDisposition('')).toBeNull();
    expect(fileNameFromContentDisposition('attachment')).toBeNull();
  });

  it('百分比編碼不合法時不丟例外，改用 filename', () => {
    const header = `attachment; filename="fallback.csv"; filename*=UTF-8''%E6%90`;
    expect(fileNameFromContentDisposition(header)).toBe('fallback.csv');
  });
});
