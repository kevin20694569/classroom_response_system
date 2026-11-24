import { existsSync } from 'node:fs';
import type { ApiErrorBody } from '@crs/shared';
import fastifyStatic from '@fastify/static';
import Fastify, { LogController, type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { Logger } from 'pino';
import { AuthService } from './auth/authService.js';
import { FirstSubmissionStrategy } from './domain/ranking/firstSubmissionStrategy.js';
import { GroupRoster } from './domain/roster/groupRoster.js';
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
  /** 組員斷線後仍算在組內的時間（預設 30 秒；測試可縮短，004 FR-012） */
  rosterGraceMs?: number;
}

export interface BuiltApp {
  app: FastifyInstance;
  service: QuizSessionService;
  auth: AuthService;
  roster: GroupRoster;
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

  // 組員名冊只在記憶體（004 research R4）；已離開的組員由身分服務視為失效
  const roster = new GroupRoster(
    options.rosterGraceMs === undefined ? {} : { graceMs: options.rosterGraceMs },
  );
  const auth = new AuthService(options.sessionSecret, options.teacherPassword, now, {
    isMemberLeft: (memberId) => roster.hasLeft(memberId),
  });

  registerErrorHandler(app);
  registerAuth(app, auth, service);
  registerAuthRoutes(app, auth, service, roster);
  registerSessionRoutes(app, service, roster);
  registerSubmissionRoutes(app, new SubmissionService(service));

  const webDistDir = options.webDistDir;
  const serveWeb = webDistDir !== undefined && existsSync(webDistDir);
  if (serveWeb) {
    await app.register(fastifyStatic, { root: webDistDir, wildcard: false });
  }
  // 找不到的路徑一律回契約的錯誤格式（contracts/http-api.md）；前端已建置時，頁面路徑交給前端路由
  app.setNotFoundHandler((request, reply) => {
    const isPage =
      request.method === 'GET' &&
      !request.url.startsWith('/api') &&
      !request.url.startsWith('/socket.io');
    if (serveWeb && isPage) return reply.sendFile('index.html');
    const body: ApiErrorBody = {
      error: {
        code: 'VALIDATION_FAILED',
        message: isPage ? '找不到這個頁面。' : '找不到這個 API。',
      },
    };
    return reply.status(404).send(body);
  });

  const realtime = new RealtimeGateway(app.server, service, auth, roster, options.logger);
  app.addHook('preClose', async () => {
    await realtime.close();
  });

  return { app, service, auth, roster, realtime };
}
