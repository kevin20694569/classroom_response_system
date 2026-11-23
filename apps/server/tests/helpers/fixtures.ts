import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { SpreadsheetSnapshot } from '../../src/infrastructure/sheets/guidedNotesGateway.js';

const FIXTURE_DIR = path.resolve(import.meta.dirname, '../fixtures/guided-notes');

/** 讀取 Guided Notes 測試資料（依課程兩份範例的版面製作，題目一律為簡答題）。 */
export function loadFixture(name: string): SpreadsheetSnapshot {
  return JSON.parse(
    readFileSync(path.join(FIXTURE_DIR, `${name}.json`), 'utf8'),
  ) as SpreadsheetSnapshot;
}
