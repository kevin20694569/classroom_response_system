import type { ErrorCode, ErrorDetail } from '@crs/shared';

/**
 * 領域錯誤：帶有錯誤代碼與「使用者看得懂」的繁體中文訊息。
 * 訊息不得包含堆疊、檔案路徑或憑證（constitution 原則 VIII、FR-026）。
 */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly userMessage: string;
  readonly details: ErrorDetail[] | undefined;

  constructor(code: ErrorCode, userMessage: string, details?: ErrorDetail[]) {
    super(userMessage);
    this.name = 'DomainError';
    this.code = code;
    this.userMessage = userMessage;
    this.details = details;
  }
}

/** 錯誤代碼對應的 HTTP 狀態碼（contracts/http-api.md）。 */
const HTTP_STATUS: Readonly<Record<ErrorCode, number>> = {
  VALIDATION_FAILED: 400,
  UNAUTHORIZED: 401,
  INVALID_PASSWORD: 401,
  FORBIDDEN: 403,
  LEAVE_NOT_ALLOWED: 409,
  GRADE_NOT_ALLOWED: 409,
  SUBMISSION_NOT_FOUND: 404,
  INVALID_SPREADSHEET_URL: 400,
  SHEETS_UNAVAILABLE: 502,
  GUIDED_NOTES_INVALID: 422,
  EXPORT_LOCATE_FAILED: 422,
  INVALID_TRANSITION: 409,
  ALREADY_IN_STATE: 409,
  CONFIRM_DISCARD_REQUIRED: 409,
  NO_ACTIVE_ACTIVITY: 409,
  INVALID_GROUP: 400,
  SESSION_NOT_OPEN: 409,
  QUESTION_NOT_FOUND: 404,
  ANSWER_INCOMPLETE: 400,
  ANSWER_INVALID: 400,
  ALREADY_SUBMITTED: 409,
  INTERNAL_ERROR: 500,
};

export function httpStatusOf(code: ErrorCode): number {
  return HTTP_STATUS[code];
}
