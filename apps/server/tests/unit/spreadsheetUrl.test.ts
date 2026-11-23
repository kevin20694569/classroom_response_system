import { describe, expect, it } from 'vitest';
import { parseSpreadsheetUrl } from '../../src/infrastructure/sheets/spreadsheetUrl.js';

describe('parseSpreadsheetUrl', () => {
  it.each([
    [
      'https://docs.google.com/spreadsheets/d/12uh5xhIx2wXFMy42KU8lN7rLFQ8GDugt9zfAFEvu-1E/edit?gid=1167716485#gid=1167716485',
      '12uh5xhIx2wXFMy42KU8lN7rLFQ8GDugt9zfAFEvu-1E',
    ],
    [
      'https://docs.google.com/spreadsheets/d/1PXXwWiBKJNpPkLRoJLMzZWsAh4Jzn2bThHTeRAiq3Hg/edit#gid=1028924918',
      '1PXXwWiBKJNpPkLRoJLMzZWsAh4Jzn2bThHTeRAiq3Hg',
    ],
    ['  https://docs.google.com/spreadsheets/d/abc_DEF-123  ', 'abc_DEF-123'],
  ])('%s', (url, id) => {
    expect(parseSpreadsheetUrl(url)).toEqual({ spreadsheetId: id });
  });

  it.each([
    'not a url',
    'http://docs.google.com/spreadsheets/d/abc/edit',
    'https://example.com/spreadsheets/d/abc/edit',
    'https://docs.google.com/document/d/abc/edit',
    'https://docs.google.com/spreadsheets/u/0/',
  ])('拒絕 %s', (url) => {
    expect(() => parseSpreadsheetUrl(url)).toThrow(
      expect.objectContaining({ code: 'INVALID_SPREADSHEET_URL' }),
    );
  });
});
