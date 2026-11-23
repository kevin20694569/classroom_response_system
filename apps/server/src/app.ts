import { existsSync } from 'node:fs';
import fastifyStatic from '@fastify/static';
import Fastify, { LogController, type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { AuthService } from './auth/authService.js';
import { FirstSubmissionStrategy } from './domain/ranking/firstSubmissionStrategy.js';
import { QuizSessionService } from './domain/session/quizSessionService.js';
import { SubmissionService } from './domain/submission/submissionService.js';
import type { SessionRepository } from './infrastructure/persistence/sessionRepository.js';
import type { GuidedNotesGateway } from './infrastructure/sheets/guidedNotesGateway.js';
import { registerAuth } from './transport/http/auth.js';
import { registerErrorHandler } from './transport/http/errorHandler.js';
import { registerAuthRoutes } from './transport/http/routes/authRoutes.js';
import { registerSessionRoutes } from './transport/http/routes/sessionRoutes.js';
import { registerSubmissionRoutes } from './transport/http/routes/submissionRoutes.js';
import { RealtimeGateway } from './transport/realtime/realtimeGateway.js';

export interface BuildAppOptions {
  teacherPassword: string;
  sessionSecret: string;
  gateway: GuidedNotesGateway;
  repository: SessionRepository;
  logger: Logger;
  now?: () => Date;
  uuid?: () => string;
  /** 前端建置後的目錄；存在時由同一個埠提供網頁 */
  webDistDir?: string;
}

export interface BuiltApp {
  app: FastifyInstance;
  service: QuizSessionService;
  auth: AuthService;
  realtime: RealtimeGateway;
}

/**
 * 組裝依賴（不含業務邏輯）：Fastify、錯誤處理、身分、路由、活動服務、即時推播與靜態網頁。
 */
export async function buildApp(options: BuildAppOptions): Promise<BuiltApp> {
  const now = options.now ?? (() => new Date());
  const uuid = options.uuid ?? (() => crypto.randomUUID());

  const fastifyLogger: FastifyBaseLogger = options.logger;
  const app: FastifyInstance = Fastify({
    loggerInstance: fastifyLogger,
    // 不記錄每個請求的存取 log（只記錄關鍵事件，避免雜訊）
    logController: new LogController({ disableRequestLogging: true }),
  });
  const service = new QuizSessionService({
    repository: options.repository,
    gateway: options.gateway,
    ranking: new FirstSubmissionStrategy(),
    logger: options.logger,
    now,
    uuid,
  });
  await service.init();

  const auth = new AuthService(options.sessionSecret, options.teacherPassword, now);

  registerErrorHandler(app);
  registerAuth(app, auth, service);
  registerAuthRoutes(app, auth, service);
  registerSessionRoutes(app, service);
  registerSubmissionRoutes(app, new SubmissionService(service));

  const webDistDir = options.webDistDir;
  if (webDistDir !== undefined && existsSync(webDistDir)) {
    await app.register(fastifyStatic, { root: webDistDir, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      const isPage =
        request.method === 'GET' &&
        !request.url.startsWith('/api') &&
        !request.url.startsWith('/socket.io');
      if (isPage) return reply.sendFile('index.html');
      return reply
        .status(404)
        .send({ error: { code: 'VALIDATION_FAILED', message: '找不到這個 API。' } });
    });
  }

  const realtime = new RealtimeGateway(app.server, service, auth, options.logger);
  app.addHook('preClose', async () => {
    await realtime.close();
  });

  return { app, service, auth, realtime };
}
