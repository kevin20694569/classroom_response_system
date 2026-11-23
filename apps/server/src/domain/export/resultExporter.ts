import type { ExportMode, QuestionResult, QuizSession } from '@crs/shared';

export interface ExportReport {
  writtenQuestionCount: number;
  writtenCellCount: number;
}

/**
 * 結果匯出介面（擴充點，constitution 原則 IV）：課程已知延伸功能「匯出至 CSV」
 * 可以新增其他實作而不改動活動服務。核心階段只實作 GuidedNotesExporter（寫回原 Guided Notes）。
 */
export interface ResultExporter {
  /** mode：老師選擇的匯出模式（002 FR-017）；其他匯出目的地可依需要忽略 */
  export(
    session: Readonly<QuizSession>,
    results: readonly QuestionResult[],
    mode: ExportMode,
  ): Promise<ExportReport>;
}
