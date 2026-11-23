import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../../auth/authService.js';
import type { TabIdentity } from '../../auth/tokens.js';
import { DomainError } from '../../domain/errors.js';
import type { QuizSessionService } from '../../domain/session/quizSessionService.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** 由 Authorization: Bearer token 解析出的分頁身分；未帶 token 為 null */
    identity: TabIdentity | null;
  }
}

/** 從 Authorization 標頭取出 token；沒有或格式不符回傳 null。 */
export function bearerToken(header: string | undefined): string | null {
  if (header === undefined) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * 解析每個 /api 請求的身分：沒帶 token 視為未登入；帶了但無效（偽造、過期、屬於舊活動）
 * 一律回 401 UNAUTHORIZED，讓前端清除 token 並回到登入畫面。
 */
export function registerAuth(
  app: FastifyInstance,
  auth: AuthService,
  service: QuizSessionService,
): void {
  app.decorateRequest('identity', null);
  app.addHook('onRequest', (request, _reply, done) => {
    if (!request.url.startsWith('/api/')) {
      done();
      return;
    }
    const token = bearerToken(request.headers.authorization);
    if (token === null) {
      request.identity = null;
      done();
      return;
    }
    const identity = auth.resolve(token, service.getSession().activityId);
    if (identity === null) {
      done(new DomainError('UNAUTHORIZED', '登入已失效，請重新登入或重新加入。'));
      return;
    }
    request.identity = identity;
    done();
  });
}
