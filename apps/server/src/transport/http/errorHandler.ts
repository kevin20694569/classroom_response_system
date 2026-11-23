import type { ApiErrorBody, ErrorCode, ErrorDetail } from '@crs/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { DomainError, httpStatusOf } from '../../domain/errors.js';

function sendError(
  reply: FastifyReply,
  status: number,
  code: ErrorCode,
  message: string,
  details?: ErrorDetail[],
): FastifyReply {
  const body: ApiErrorBody = {
    error: details === undefined ? { code, message } : { code, message, details },
  };
  return reply.status(status).send(body);
}

/**
 * 統一錯誤處理（FR-026、constitution 原則 VIII）：
 * 回應只含錯誤代碼與使用者看得懂的訊息；未預期錯誤的堆疊與原文只寫入 log。
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: unknown, request, reply) => {
    if (error instanceof DomainError) {
      return sendError(
        reply,
        httpStatusOf(error.code),
        error.code,
        error.userMessage,
        error.details,
      );
    }
    if (error instanceof ZodError) {
      const details: ErrorDetail[] = error.issues.map((issue) => ({
        code: 'INVALID_FIELD',
        message: `欄位「${issue.path.join('.') || '(請求內容)'}」格式不正確`,
      }));
      return sendError(reply, 400, 'VALIDATION_FAILED', '請求格式不正確。', details);
    }
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      return sendError(reply, 400, 'VALIDATION_FAILED', '請求格式不正確。');
    }
    request.log.error({ err: error }, '未預期的錯誤');
    return sendError(reply, 500, 'INTERNAL_ERROR', '系統發生錯誤，請稍後再試。');
  });
}
