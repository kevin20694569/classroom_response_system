import { DomainError } from '../../domain/errors.js';
import type { SpreadsheetRef } from './guidedNotesGateway.js';

/**
 * 從老師貼上的網址取出 Google Sheets 文件 ID（FR-006a）。
 * 只接受 https://docs.google.com/spreadsheets/d/{id}/...；網址中的分頁編號（#gid=）不影響工作表選擇。
 */
export function parseSpreadsheetUrl(input: string): SpreadsheetRef {
  const fail = () =>
    new DomainError(
      'INVALID_SPREADSHEET_URL',
      '網址格式不正確，請貼上 Google Sheets 文件網址（https://docs.google.com/spreadsheets/d/…）。',
    );
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw fail();
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') throw fail();
  const match = /^\/spreadsheets\/d\/([A-Za-z0-9_-]+)(?:\/|$)/.exec(url.pathname);
  const spreadsheetId = match?.[1];
  if (spreadsheetId === undefined) throw fail();
  return { spreadsheetId };
}
