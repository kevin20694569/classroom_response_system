import { pino, type Logger } from 'pino';

/**
 * 結構化 log（技術限制章節、FR-027）：記錄關鍵事件，但遮蔽所有機敏資訊。
 */
export const LogEvent = {
  SessionTransition: 'session.transition',
  SubmissionAccepted: 'submission.accepted',
  SubmissionRejected: 'submission.rejected',
  ImportSucceeded: 'import.succeeded',
  ImportFailed: 'import.failed',
  ExportSucceeded: 'export.succeeded',
  ExportFailed: 'export.failed',
} as const;

export const REDACT_PATHS = [
  'password',
  'token',
  'authorization',
  '*.password',
  '*.token',
  '*.authorization',
  'req.headers.authorization',
  'headers.authorization',
  'GOOGLE_SERVICE_ACCOUNT_KEY_FILE',
  'keyFile',
];

export function createLogger(options: { level?: string } = {}): Logger {
  return pino({
    level: options.level ?? 'info',
    redact: { paths: REDACT_PATHS, censor: '[已遮蔽]' },
  });
}
