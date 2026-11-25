import { z } from 'zod';
import {
  DEFAULT_EXPORT_MODE,
  ExportModeSchema,
  GroupIdSchema,
  MAX_GROUPS,
  MIN_GROUPS,
} from './domain.js';
import { NicknameSchema } from './nickname.js';
import { SessionViewSchema, TeacherViewSchema } from './views.js';

/**
 * HTTP API 請求與回應（contracts/http-api.md）。
 * 請求一律使用 strict schema：多餘欄位（例如客戶端自行帶入的時間或組別）會被拒絕（原則 I）。
 */

export const TeacherLoginRequestSchema = z.strictObject({
  password: z.string().min(1).max(200),
});
export type TeacherLoginRequest = z.infer<typeof TeacherLoginRequestSchema>;

/**
 * 組別是否存在（1～groupCount）由伺服器檢查，不符時回 INVALID_GROUP。
 * 暱稱（004 FR-004）以 NicknameSchema 驗證並正規化，寫入 token 後作為送出者暱稱的唯一來源。
 */
export const StudentJoinRequestSchema = z.strictObject({
  groupId: z.number().int(),
  nickname: NicknameSchema,
});
export type StudentJoinRequest = z.infer<typeof StudentJoinRequestSchema>;

export const IdentitySummarySchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('teacher'), expiresAt: z.string() }),
  z.object({
    role: z.literal('student'),
    groupId: GroupIdSchema,
    activityId: z.uuid(),
    /** 組員身分（004 research R3）：加入時由伺服器產生，同一分頁重新整理不變 */
    memberId: z.uuid(),
    /** 加入時的暱稱（已去除前後空白） */
    nickname: z.string(),
    expiresAt: z.string(),
  }),
]);
export type IdentitySummary = z.infer<typeof IdentitySummarySchema>;

export const AuthResponseSchema = z.object({
  token: z.string(),
  identity: IdentitySummarySchema,
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const SessionViewResponseSchema = z.object({ view: SessionViewSchema });
export type SessionViewResponse = z.infer<typeof SessionViewResponseSchema>;

export const TeacherViewResponseSchema = z.object({ view: TeacherViewSchema });
export type TeacherViewResponse = z.infer<typeof TeacherViewResponseSchema>;

export const ImportRequestSchema = z.strictObject({
  spreadsheetUrl: z.string().trim().min(1).max(2000),
  groupCount: z.number().int().min(MIN_GROUPS).max(MAX_GROUPS),
  /** 狀態為「已結束」時必須為 true，確認放棄目前結果 */
  confirmDiscard: z.boolean().optional(),
});
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

/** 開啟、結束、匯出等不需要參數的請求。 */
export const EmptyRequestSchema = z.strictObject({});

/** 匯出請求（002 FR-017）：省略 mode 等同「只有答案」，與 001 的 `{}` 相容；其他欄位一律拒絕。 */
export const ExportRequestSchema = z.strictObject({
  mode: ExportModeSchema.default(DEFAULT_EXPORT_MODE),
});
export type ExportRequest = z.input<typeof ExportRequestSchema>;

export const ExportResponseSchema = z.object({
  mode: ExportModeSchema,
  writtenQuestionCount: z.number().int().nonnegative(),
  writtenCellCount: z.number().int().nonnegative(),
  exportedAt: z.string(),
});
export type ExportResponse = z.infer<typeof ExportResponseSchema>;

/**
 * 送出答案：組別取自 token，請求中不得也無法指定組別；不接受任何時間欄位。
 * 答案長度的業務規則（1～200 字）由伺服器領域層檢查，以便回報 ANSWER_INVALID 與子題位置。
 */
export const SubmitRequestSchema = z.strictObject({
  questionNumber: z.number().int().positive(),
  answers: z
    .array(
      z.strictObject({
        blankIndex: z.number().int().positive(),
        text: z.string().max(10_000),
      }),
    )
    .max(50),
});
export type SubmitRequest = z.infer<typeof SubmitRequestSchema>;

/** 老師批改一筆送出（004 FR-031）：只在「已結束」接受；學生不能呼叫。 */
export const GradeRequestSchema = z.strictObject({
  submissionId: z.uuid(),
  correct: z.boolean(),
});
export type GradeRequest = z.infer<typeof GradeRequestSchema>;

/** 送出成功的回應：不含順位或是否搶答成功（FR-020）。 */
export const SubmitResponseSchema = z.object({
  submissionId: z.uuid(),
  receivedAt: z.string(),
});
export type SubmitResponse = z.infer<typeof SubmitResponseSchema>;
