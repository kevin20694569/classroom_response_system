import { z } from 'zod';

/** 組數範圍（FR-004）。 */
export const MIN_GROUPS = 2;
export const MAX_GROUPS = 20;
/** 每個填空格答案去除前後空白後的長度上限（FR-017a）。 */
export const ANSWER_MAX_LENGTH = 200;

/** 以 Unicode 字元（code point）計算長度，避免中文以外的字元（如 emoji）被算成兩個字。 */
export function unicodeLength(text: string): number {
  return Array.from(text).length;
}

export const RoleSchema = z.enum(['teacher', 'student']);
export type Role = z.infer<typeof RoleSchema>;

/** 搶答活動狀態（FR-012）：尚未匯入、待開始、搶答進行中、已結束。 */
export const SessionStatusSchema = z.enum(['NOT_IMPORTED', 'READY', 'OPEN', 'CLOSED']);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SESSION_STATUS_LABEL: Readonly<Record<SessionStatus, string>> = {
  NOT_IMPORTED: '尚未匯入',
  READY: '待開始',
  OPEN: '搶答進行中',
  CLOSED: '已結束',
};

export const GroupIdSchema = z.number().int().min(1).max(MAX_GROUPS);
export type GroupId = z.infer<typeof GroupIdSchema>;

/** 組別名稱固定為「第 {id} 組」。 */
export function groupName(id: GroupId): string {
  return `第 ${id} 組`;
}

export const GroupSchema = z
  .object({ id: GroupIdSchema, name: z.string() })
  .refine((g) => g.name === groupName(g.id), { message: '組別名稱必須為「第 {id} 組」' });
export type Group = z.infer<typeof GroupSchema>;

const PositiveInt = z.number().int().positive();
const IsoDateTime = z.iso.datetime({ offset: true });

export const GuidedNotesRefSchema = z.object({
  spreadsheetId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  /** 匯入時選中的工作表名稱，僅供顯示；匯出時依規則重新選擇（FR-006a） */
  sheetTitle: z.string(),
});
export type GuidedNotesRef = z.infer<typeof GuidedNotesRefSchema>;

/** 儲存格位置（0 起算；合併儲存格指左上角）。 */
export const CellLocationSchema = z.object({
  sheetTitle: z.string(),
  rowIndex: z.number().int().nonnegative(),
  columnIndex: z.number().int().nonnegative(),
});
export type CellLocation = z.infer<typeof CellLocationSchema>;

export const BlankSchema = z.object({
  /** 子題序號，從 1 連續編號（單題為 1） */
  index: PositiveInt,
  /** 原有的「（n）」標記原文；沒有標記為 null */
  label: z.string().nullable(),
  location: CellLocationSchema,
  /**
   * 題組子題的敘述（取該子題作答格所在列的「題目」欄）；單題一律 null。
   * 預設 null，讓 001 的保存檔（沒有此欄位）可直接載入（002 research R2）。
   */
  prompt: z.string().nullable().default(null),
  /**
   * 子題標記是否與填答格在同一格（002 FR-025）。true：匯出寫「（n）答案」；
   * false：標記在獨立的標記格（例如課程題組範例的 G 欄），匯出只寫答案、不改動標記格。
   * 預設 true 以相容舊保存檔。
   */
  labelInAnswerCell: z.boolean().default(true),
});
export type Blank = z.infer<typeof BlankSchema>;

export const QuestionKindSchema = z.enum(['single', 'group']);
export type QuestionKind = z.infer<typeof QuestionKindSchema>;

export const QuestionSchema = z
  .object({
    number: PositiveInt,
    order: PositiveInt,
    kind: QuestionKindSchema,
    blanks: z.array(BlankSchema).min(1),
    /**
     * 單題為題目敘述；題組為題組說明（區塊內不屬於任何子題列的敘述）；沒有則為 null。
     * 只供老師端預覽，不會出現在學生或公開檢視（002 FR-007）。預設 null 以相容 001 保存檔。
     */
    prompt: z.string().nullable().default(null),
  })
  .superRefine((q, ctx) => {
    // 單題恰 1 個填空格；題組至少 2 個（FR-009a）
    if (q.kind === 'single' && q.blanks.length !== 1) {
      ctx.addIssue({ code: 'custom', message: '單題必須恰有 1 個填空格' });
    }
    if (q.kind === 'group' && q.blanks.length < 2) {
      ctx.addIssue({ code: 'custom', message: '題組至少要有 2 個填空格' });
    }
    q.blanks.forEach((b, i) => {
      if (b.index !== i + 1) {
        ctx.addIssue({ code: 'custom', message: '填空格序號必須從 1 連續編號' });
      }
    });
  });
export type Question = z.infer<typeof QuestionSchema>;

/** 每個答案：去除前後空白後 1～200 字（以 Unicode 字元計，FR-017a）。 */
export const AnswerTextSchema = z
  .string()
  .trim()
  .refine((t) => unicodeLength(t) >= 1 && unicodeLength(t) <= ANSWER_MAX_LENGTH, {
    message: `答案需為 1～${ANSWER_MAX_LENGTH} 字`,
  });

export const BlankAnswerSchema = z.object({
  blankIndex: PositiveInt,
  text: AnswerTextSchema,
});
export type BlankAnswer = z.infer<typeof BlankAnswerSchema>;

export const SubmissionSchema = z.object({
  id: z.uuid(),
  questionNumber: PositiveInt,
  groupId: GroupIdSchema,
  answers: z.array(BlankAnswerSchema).min(1),
  /** 伺服器依處理順序指派，決定順位（FR-016） */
  sequence: PositiveInt,
  /** 伺服器時間，僅供顯示，不用於排序 */
  receivedAt: IsoDateTime,
  /**
   * 送出者暱稱（004 FR-023）：取自送出者的 token，只用於顯示，不影響順位與搶答判定。
   * 004 之前保存的送出紀錄沒有這個欄位，讀取時視為 null。
   */
  submitterNickname: z.string().nullable().default(null),
  /**
   * 送出者的學生身分，取自 token 的 memberId（006 FR-008）：老師端「分組情況」依此把題號標註到實際送出的組員，
   * 不依暱稱比對（同組可能有相同暱稱）。只由伺服器寫入；006 之前保存的送出紀錄讀取時為 null，不標註到任何組員。
   */
  submitterMemberId: z.uuid().nullable().default(null),
});
export type Submission = z.infer<typeof SubmissionSchema>;

/**
 * 匯出模式（002 FR-017）：老師每次匯出時選擇，預設「只有答案」。
 * 組別與提交時間一律與答案在視覺上分開（FR-018）。
 */
export const ExportModeSchema = z.enum([
  'answers-only',
  'answers-with-columns',
  'answers-with-note-line',
]);
export type ExportMode = z.infer<typeof ExportModeSchema>;

export const DEFAULT_EXPORT_MODE: ExportMode = 'answers-only';

export const EXPORT_MODE_LABEL: Readonly<Record<ExportMode, string>> = {
  'answers-only': '只有答案',
  'answers-with-columns': '答案＋組別時間欄',
  'answers-with-note-line': '答案＋格內附註行',
};

export const EXPORT_MODE_DESCRIPTION: Readonly<Record<ExportMode, string>> = {
  'answers-only': '只把答案寫入原本的填空格（與先前相同）。',
  'answers-with-columns':
    '答案寫入填空格，並在表頭列新增「搶答組別」「提交時間」「搶答送出者」三欄記錄結果。',
  'answers-with-note-line':
    '答案下方另起一行，以灰色小字記錄組別、送出者與時間；複製答案格時會一併複製這一行。',
};

export const LastExportSchema = z.object({
  exportedAt: IsoDateTime,
  writtenQuestionCount: z.number().int().nonnegative(),
  /** 該次匯出使用的模式；001 保存檔沒有此欄位，預設為「只有答案」（002 research R2） */
  mode: ExportModeSchema.default(DEFAULT_EXPORT_MODE),
});
export type LastExport = z.infer<typeof LastExportSchema>;

export const QuizSessionSchema = z
  .object({
    activityId: z.uuid().nullable(),
    status: SessionStatusSchema,
    source: GuidedNotesRefSchema.nullable(),
    groups: z.array(GroupSchema).max(MAX_GROUPS),
    questions: z.array(QuestionSchema),
    submissions: z.array(SubmissionSchema),
    nextSequence: PositiveInt,
    openedAt: IsoDateTime.nullable(),
    closedAt: IsoDateTime.nullable(),
    lastExport: LastExportSchema.nullable(),
  })
  .superRefine((s, ctx) => {
    if (s.status === 'NOT_IMPORTED') {
      if (s.activityId !== null || s.questions.length > 0 || s.groups.length > 0) {
        ctx.addIssue({ code: 'custom', message: '尚未匯入時不得有活動、題目或組別' });
      }
      return;
    }
    if (s.activityId === null || s.source === null) {
      ctx.addIssue({ code: 'custom', message: '已匯入的活動必須有 activityId 與來源文件' });
    }
    if (s.groups.length < MIN_GROUPS) {
      ctx.addIssue({ code: 'custom', message: `組數必須為 ${MIN_GROUPS}～${MAX_GROUPS}` });
    }
    if (s.questions.length === 0) {
      ctx.addIssue({ code: 'custom', message: '已匯入的活動至少要有 1 題' });
    }
  });
export type QuizSession = z.infer<typeof QuizSessionSchema>;

/** 推導值：每題的搶答成功作答紀錄，沒有作答為 null（無人搶答）。 */
export const QuestionResultSchema = z.object({
  questionNumber: PositiveInt,
  winner: SubmissionSchema.nullable(),
});
export type QuestionResult = z.infer<typeof QuestionResultSchema>;

/** 本機保存檔格式（data/session.json），不含任何 token、密碼或憑證。 */
export const PersistedStateSchema = z.object({
  schemaVersion: z.literal(1),
  session: QuizSessionSchema,
});
export type PersistedState = z.infer<typeof PersistedStateSchema>;
