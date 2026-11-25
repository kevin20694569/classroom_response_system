import {
  DEFAULT_EXPORT_MODE,
  groupName,
  type ExportMode,
  type GroupId,
  type QuizSession,
  type SessionStatus,
} from '@crs/shared';
import type { SessionRepository } from '../../infrastructure/persistence/sessionRepository.js';
import type { GuidedNotesGateway } from '../../infrastructure/sheets/guidedNotesGateway.js';
import { parseSpreadsheetUrl } from '../../infrastructure/sheets/spreadsheetUrl.js';
import { DomainError } from '../errors.js';
import { GuidedNotesExporter } from '../export/guidedNotesExporter.js';
import type { ResultExporter } from '../export/resultExporter.js';
import { parseGuidedNotes } from '../guidedNotes/parser.js';
import type { DomainLogger } from '../logger.js';
import { AsyncMutex } from '../mutex.js';
import type { RankingStrategy } from '../ranking/rankingStrategy.js';
import { deriveResults } from '../ranking/results.js';
import { assertTransition, initialSession } from './quizSession.js';

export interface ImportOptions {
  spreadsheetUrl: string;
  groupCount: number;
  confirmDiscard?: boolean | undefined;
}

/** 變更類型：決定即時推播要送給哪些 room（contracts/realtime-events.md）。 */
export type ChangeKind = 'state' | 'submission' | 'export' | 'reset';

export interface SessionChange {
  kind: ChangeKind;
  /** submission 變更時為送出的組別 */
  groupId?: GroupId;
}

export type ChangeListener = (changes: readonly SessionChange[], version: number) => void;

export interface QuizSessionServiceDeps {
  repository: SessionRepository;
  gateway: GuidedNotesGateway;
  ranking: RankingStrategy;
  logger: DomainLogger;
  now: () => Date;
  uuid: () => string;
  /** 預設為寫回原 Guided Notes；延伸功能（如 CSV）可替換 */
  exporter?: ResultExporter;
}

export interface ExportResult {
  mode: ExportMode;
  writtenQuestionCount: number;
  writtenCellCount: number;
  exportedAt: string;
}

/** mutate 的回呼回傳：新狀態（未變更時回傳原物件）、回覆給呼叫端的結果、變更類型。 */
export interface MutationOutcome<T> {
  next: QuizSession;
  result: T;
  changes: SessionChange[];
}

/**
 * 搶答活動服務：活動狀態的唯一持有者（constitution 原則 I）。
 *
 * 所有狀態變更都經過 mutate：在同一把鎖內依序執行，回呼回傳「新的狀態物件」，
 * 保存成功後才替換記憶體狀態並通知推播；保存失敗時記憶體狀態不變、操作回報失敗
 * （FR-028「保存完成才回覆」）。
 */
export class QuizSessionService {
  private session: QuizSession = initialSession();
  private version = 0;
  private readonly mutex = new AsyncMutex();
  private readonly listeners = new Set<ChangeListener>();

  constructor(readonly deps: QuizSessionServiceDeps) {}

  /** 啟動時從保存庫恢復狀態（伺服器重啟後回到最後保存的狀態）。 */
  async init(): Promise<void> {
    const loaded = await this.deps.repository.load();
    if (loaded !== null) this.session = loaded;
  }

  getSession(): Readonly<QuizSession> {
    return this.session;
  }

  getVersion(): number {
    return this.version;
  }

  onChange(listener: ChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async mutate<T>(
    fn: (current: Readonly<QuizSession>) => MutationOutcome<T> | Promise<MutationOutcome<T>>,
  ): Promise<T> {
    return this.mutex.runExclusive(async () => {
      const { next, result, changes } = await fn(this.session);
      if (next === this.session) return result;
      await this.deps.repository.save(next);
      this.session = next;
      this.version += 1;
      this.emit(changes);
      return result;
    });
  }

  /**
   * 匯入 Guided Notes（US1，FR-006～FR-011）：
   * 在鎖內依序「檢查狀態 → 解析網址 → 讀取線上文件 → 辨識題目」，全部成功才整批替換並保存；
   * 任何一步失敗都不改變資料（不留下只匯入一半的題目）。
   * 每次匯入都是新的一場活動：activityId 換新，已加入的學生身分全部失效（spec 邊界案例）。
   */
  async importQuestions(options: ImportOptions): Promise<QuizSession> {
    const { logger } = this.deps;
    try {
      const session = await this.mutate(async (current) => {
        assertTransition(current.status, 'import', { confirmDiscard: options.confirmDiscard });
        const ref = parseSpreadsheetUrl(options.spreadsheetUrl);
        const snapshot = await this.deps.gateway.read(ref);
        const parsed = parseGuidedNotes(snapshot);
        const next: QuizSession = {
          activityId: this.deps.uuid(),
          status: 'READY',
          source: { spreadsheetId: ref.spreadsheetId, sheetTitle: parsed.sheetTitle },
          groups: Array.from({ length: options.groupCount }, (_, i) => ({
            id: i + 1,
            name: groupName(i + 1),
          })),
          questions: parsed.questions,
          submissions: [],
          nextSequence: 1,
          openedAt: null,
          closedAt: null,
          lastExport: null,
          // 新的一場活動：批改狀態清空（004 FR-035）
          gradingFinishedAt: null,
        };
        const changes: SessionChange[] =
          current.activityId === null
            ? [{ kind: 'state' }]
            : [{ kind: 'reset' }, { kind: 'state' }];
        return { next, result: next, changes };
      });
      logger.info(
        {
          event: 'import.succeeded',
          questionCount: session.questions.length,
          groupCount: session.groups.length,
          sheetTitle: session.source?.sheetTitle,
        },
        '匯入 Guided Notes 成功',
      );
      return session;
    } catch (error) {
      logger.warn(
        {
          event: 'import.failed',
          code: error instanceof DomainError ? error.code : 'INTERNAL_ERROR',
        },
        '匯入 Guided Notes 失敗',
      );
      throw error;
    }
  }

  /** 開啟搶答（FR-013）：全部題目同時開放作答，所有已連線分頁即時同步。 */
  open(): Promise<QuizSession> {
    return this.transition('open');
  }

  /** 結束搶答（FR-015）：之後處理的送出一律被拒絕；不可重新開啟（FR-012）。 */
  close(): Promise<QuizSession> {
    return this.transition('close');
  }

  private async transition(action: 'open' | 'close'): Promise<QuizSession> {
    let from: SessionStatus = this.session.status;
    const session = await this.mutate((current) => {
      from = current.status;
      assertTransition(current.status, action, { questionCount: current.questions.length });
      const at = this.deps.now().toISOString();
      const next: QuizSession =
        action === 'open'
          ? { ...current, status: 'OPEN', openedAt: at }
          : { ...current, status: 'CLOSED', closedAt: at };
      return { next, result: next, changes: [{ kind: 'state' }] };
    });
    this.deps.logger.info(
      { event: 'session.transition', from, to: session.status },
      '活動狀態已轉換',
    );
    return session;
  }

  /**
   * 老師批改一筆送出（004 FR-031、FR-033）：只在「已結束」接受；勾選與原本相同時不改變資料。
   * 經同一把鎖修改並保存，推播 state 變更讓該組立即看到「答對」或回到「等待老師批改」。
   */
  async grade(submissionId: string, correct: boolean): Promise<QuizSession> {
    const session = await this.mutate((current) => {
      if (current.status !== 'CLOSED') {
        throw new DomainError('GRADE_NOT_ALLOWED', '搶答結束後才能批改。');
      }
      const graded = current.submissions.find((s) => s.id === submissionId);
      if (graded === undefined) {
        throw new DomainError('SUBMISSION_NOT_FOUND', '找不到這筆送出，請重新整理後再試。');
      }
      if (graded.correct === correct) return { next: current, result: current, changes: [] };
      const next: QuizSession = {
        ...current,
        submissions: current.submissions.map((s) =>
          s.id === submissionId ? { ...s, correct } : s,
        ),
      };
      return { next, result: next, changes: [{ kind: 'state' }] };
    });
    const graded = session.submissions.find((s) => s.id === submissionId);
    if (graded !== undefined) {
      // 以題號與組別記錄批改，不記錄暱稱（004 FR-036）
      this.deps.logger.info(
        {
          event: 'submission.graded',
          questionNumber: graded.questionNumber,
          groupId: graded.groupId,
          correct,
        },
        '老師批改送出',
      );
    }
    return session;
  }

  /**
   * 批改完成（004 FR-034）：只在「已結束」接受；重複按下不改變第一次的時間。
   * 之後未勾選的送出為答錯，學生端公布每題的搶答成功答案。
   */
  async finishGrading(): Promise<QuizSession> {
    const session = await this.mutate((current) => {
      if (current.status !== 'CLOSED') {
        throw new DomainError('GRADE_NOT_ALLOWED', '搶答結束後才能批改。');
      }
      if (current.gradingFinishedAt !== null) {
        return { next: current, result: current, changes: [] };
      }
      const next: QuizSession = { ...current, gradingFinishedAt: this.deps.now().toISOString() };
      return { next, result: next, changes: [{ kind: 'state' }] };
    });
    this.deps.logger.info({ event: 'grading.finished' }, '老師批改完成');
    return session;
  }

  /**
   * 匯出至原 Guided Notes（US4，FR-021～FR-025）：只有「已結束」才能匯出；
   * 寫入成功後保存 lastExport（含 002 的匯出模式）並推播給老師。同一模式可重複執行，結果相同（FR-024）。
   */
  async exportResults(mode: ExportMode = DEFAULT_EXPORT_MODE): Promise<ExportResult> {
    const exporter = this.deps.exporter ?? new GuidedNotesExporter(this.deps.gateway);
    try {
      const result = await this.mutate(async (current) => {
        if (current.status !== 'CLOSED') {
          throw new DomainError('INVALID_TRANSITION', '請先結束搶答，再匯出答案。');
        }
        const report = await exporter.export(
          current,
          deriveResults(current, this.deps.ranking),
          mode,
        );
        const exportedAt = this.deps.now().toISOString();
        const next: QuizSession = {
          ...current,
          lastExport: { exportedAt, writtenQuestionCount: report.writtenQuestionCount, mode },
        };
        return { next, result: { ...report, mode, exportedAt }, changes: [{ kind: 'export' }] };
      });
      this.deps.logger.info(
        {
          event: 'export.succeeded',
          mode,
          writtenQuestionCount: result.writtenQuestionCount,
          writtenCellCount: result.writtenCellCount,
        },
        '匯出至 Guided Notes 成功',
      );
      return result;
    } catch (error) {
      this.deps.logger.warn(
        {
          event: 'export.failed',
          mode,
          code: error instanceof DomainError ? error.code : 'INTERNAL_ERROR',
        },
        '匯出至 Guided Notes 失敗',
      );
      throw error;
    }
  }

  private emit(changes: readonly SessionChange[]): void {
    for (const listener of this.listeners) {
      try {
        listener(changes, this.version);
      } catch (error) {
        this.deps.logger.error({ err: error }, '推播監聽者發生錯誤');
      }
    }
  }
}
