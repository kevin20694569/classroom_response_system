import { CSV_EXPORT_NOT_CLOSED_MESSAGE, CSV_HEADERS } from '@crs/shared';
import type { ExportMode, QuestionResult, QuizSession } from '@crs/shared';
import { DomainError } from '../../errors.js';
import type { RankingStrategy } from '../../ranking/rankingStrategy.js';
import type { ResultExporter } from '../resultExporter.js';
import { csvAsciiFileName, csvFileName } from './csvFileName.js';
import { encodeCsv } from './csvEncoder.js';
import { buildResultRows, toCsvRecord } from './resultRows.js';

/** 結果 CSV 匯出的產物（data-model.md §3）。 */
export interface CsvExport {
  fileName: string;
  asciiFileName: string;
  content: string;
  /** 資料列數（不含表頭） */
  rowCount: number;
}

/**
 * 產生結果 CSV 的匯出器（ResultExporter 擴充點的第二個實作，constitution 原則 IV）。
 * 不需要匯出模式，因此忽略 mode；內容與檔名都只由活動資料決定、不含匯出當下的時間，
 * 同一場活動重複匯出的結果完全相同（FR-004、SC-006）。
 */
export class CsvResultExporter implements ResultExporter<CsvExport> {
  constructor(private readonly ranking: RankingStrategy) {}

  export(
    session: Readonly<QuizSession>,
    results: readonly QuestionResult[],
    _mode: ExportMode,
  ): Promise<CsvExport> {
    if (session.openedAt === null) {
      return Promise.reject(new DomainError('INVALID_TRANSITION', CSV_EXPORT_NOT_CLOSED_MESSAGE));
    }
    const rows = buildResultRows(session, this.ranking, results);
    return Promise.resolve({
      fileName: csvFileName(session.openedAt),
      asciiFileName: csvAsciiFileName(session.openedAt),
      content: encodeCsv(CSV_HEADERS, rows.map(toCsvRecord)),
      rowCount: rows.length,
    });
  }
}
