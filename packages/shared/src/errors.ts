import { z } from 'zod';

/**
 * API 錯誤代碼（contracts/http-api.md 錯誤表）。
 * 前端依代碼決定顯示方式；訊息文字由伺服器提供，不含堆疊、路徑或憑證。
 */
export const ErrorCodeSchema = z.enum([
  'VALIDATION_FAILED',
  'UNAUTHORIZED',
  'INVALID_PASSWORD',
  'FORBIDDEN',
  'INVALID_SPREADSHEET_URL',
  'SHEETS_UNAVAILABLE',
  'GUIDED_NOTES_INVALID',
  'EXPORT_LOCATE_FAILED',
  'INVALID_TRANSITION',
  'ALREADY_IN_STATE',
  'CONFIRM_DISCARD_REQUIRED',
  'NO_ACTIVE_ACTIVITY',
  'INVALID_GROUP',
  'SESSION_NOT_OPEN',
  'QUESTION_NOT_FOUND',
  'ANSWER_INCOMPLETE',
  'ANSWER_INVALID',
  'ALREADY_SUBMITTED',
  'INTERNAL_ERROR',
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** Guided Notes 辨識錯誤代碼（contracts/guided-notes-format.md §6）。 */
export const GuidedNotesIssueCodeSchema = z.enum([
  'HEADER_NOT_FOUND',
  'MULTIPLE_HEADER_ROWS',
  'MULTIPLE_GUIDED_NOTES_SHEETS',
  'INVALID_QUESTION_NUMBER',
  'DUPLICATE_QUESTION_NUMBER',
  'NO_QUESTIONS',
  'PARTIAL_BLANK_MARKERS',
  'INVALID_BLANK_MARKERS',
]);
export type GuidedNotesIssueCode = z.infer<typeof GuidedNotesIssueCodeSchema>;

/** 錯誤細節：用於指出問題位置（例如匯入錯誤的工作表、列、欄、題號）。 */
export const ErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  sheetTitle: z.string().optional(),
  /** 1 起算，與 Google Sheets 畫面上的列號一致 */
  row: z.number().int().positive().optional(),
  /** 欄名，例如 "G" */
  column: z.string().optional(),
  questionNumber: z.number().int().positive().optional(),
  blankIndex: z.number().int().positive().optional(),
});
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
    details: z.array(ErrorDetailSchema).optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;
