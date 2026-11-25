import type { ExportMode, QuestionResult, QuizSession } from '@crs/shared';
import type { GuidedNotesGateway } from '../../infrastructure/sheets/guidedNotesGateway.js';
import { DomainError } from '../errors.js';
import { parseGuidedNotes } from '../guidedNotes/parser.js';
import { planExport } from './exportPlan.js';
import type { ExportReport, ResultExporter } from './resultExporter.js';

/**
 * 把搶答成功的答案寫回原 Guided Notes（FR-021～FR-024）：
 * 重新讀取文件 → 依相同規則重新選擇工作表並定位（FR-006a、FR-022）→ 全部可定位才一次批次寫入（FR-023）。
 * 002：依老師選擇的匯出模式一併寫入組別與提交時間（contracts/guided-notes-format.md §B）。
 */
export class GuidedNotesExporter implements ResultExporter {
  constructor(private readonly gateway: GuidedNotesGateway) {}

  async export(
    session: Readonly<QuizSession>,
    results: readonly QuestionResult[],
    mode: ExportMode,
  ): Promise<ExportReport> {
    if (session.source === null) {
      throw new DomainError('INVALID_TRANSITION', '尚未匯入任何文件，無法匯出。');
    }
    const ref = { spreadsheetId: session.source.spreadsheetId };
    const snapshot = await this.gateway.read(ref);
    const plan = planExport(session, results, parseGuidedNotes(snapshot), mode);
    if (plan.writes.length > 0) {
      await this.gateway.writeCells(ref, plan.writes);
    }
    return {
      writtenQuestionCount: plan.writtenQuestionCount,
      writtenCellCount: plan.writes.length,
    };
  }
}
