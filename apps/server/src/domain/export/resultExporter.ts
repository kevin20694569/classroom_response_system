import type { ExportMode, QuestionResult, QuizSession } from '@crs/shared';

export interface ExportReport {
  writtenQuestionCount: number;
  writtenCellCount: number;
}

/**
 * 結果匯出介面（擴充點，constitution 原則 IV）。
 * 實作有兩個：GuidedNotesExporter（寫回原 Guided Notes，預設的 ExportReport）與
 * CsvResultExporter（子功能 005，產生 CSV 內容）。TReport 是各實作回報的結果型別。
 */
export interface ResultExporter<TReport = ExportReport> {
  /** mode：老師選擇的匯出模式（002 FR-017）；不需要的實作（例如 CSV）可以忽略 */
  export(
    session: Readonly<QuizSession>,
    results: readonly QuestionResult[],
    mode: ExportMode,
  ): Promise<TReport>;
}
