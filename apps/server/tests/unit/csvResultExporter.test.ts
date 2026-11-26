import { CSV_HEADERS } from '@crs/shared';
import { describe, expect, it } from 'vitest';
import { CsvResultExporter } from '../../src/domain/export/csv/csvResultExporter.js';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import { deriveResults } from '../../src/domain/ranking/results.js';
import { readySession, singleQuestion, submission } from '../helpers/builders.js';

const ranking = new FirstSubmissionStrategy();
const session = readySession({
  status: 'CLOSED',
  openedAt: '2026-11-26T02:32:15.123Z',
  questions: [singleQuestion(1)],
  submissions: [submission(1, 2, 1, ['CPU'], '小華'), submission(1, 1, 2, ['GPU'])],
});
const results = deriveResults(session, ranking);

describe('CsvResultExporter', () => {
  const exporter = new CsvResultExporter(ranking);

  it('連續匯出 5 次，檔名與內容完全相同（SC-006）', async () => {
    const first = await exporter.export(session, results, 'answers-only');
    for (let i = 0; i < 4; i += 1) {
      expect(await exporter.export(session, results, 'answers-only')).toEqual(first);
    }
  });

  it('忽略匯出模式', async () => {
    const a = await exporter.export(session, results, 'answers-only');
    const b = await exporter.export(session, results, 'answers-with-columns');
    expect(b).toEqual(a);
  });

  it('rowCount 為資料列數，內容在 BOM 之後以表頭開始，檔名含開啟時間', async () => {
    const exported = await exporter.export(session, results, 'answers-only');
    expect(exported.content.slice(1).startsWith(CSV_HEADERS.join(','))).toBe(true);
    expect(exported.rowCount).toBe(2);
    expect(exported.content.slice(1).split('\r\n')).toHaveLength(exported.rowCount + 2);
    expect(exported.fileName).toBe('搶答結果_20261126-1032.csv');
    expect(exported.asciiFileName).toBe('results_20261126-1032.csv');
  });
});
