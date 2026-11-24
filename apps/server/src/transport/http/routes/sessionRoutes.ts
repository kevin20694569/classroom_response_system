import {
  EmptyRequestSchema,
  ExportRequestSchema,
  ImportRequestSchema,
  type ExportResponse,
  type SessionViewResponse,
  type TeacherViewResponse,
} from '@crs/shared';
import type { FastifyInstance } from 'fastify';
import { requireTeacher } from '../../../auth/roleGuard.js';
import { DomainError } from '../../../domain/errors.js';
import type { RosterReader } from '../../../domain/roster/groupRoster.js';
import type { QuizSessionService } from '../../../domain/session/quizSessionService.js';
import { toTeacherView } from '../../../domain/visibility/visibilityPolicy.js';
import { viewFor } from '../../views.js';

/** 活動狀態與老師專屬操作 API（contracts/http-api.md）。 */
export function registerSessionRoutes(
  app: FastifyInstance,
  service: QuizSessionService,
  roster: RosterReader,
): void {
  const teacherView = (): TeacherViewResponse => ({
    view: toTeacherView(service.getSession(), service.deps.ranking, service.deps.now()),
  });

  app.get('/api/session', (request, reply) => {
    const response: SessionViewResponse = { view: viewFor(request.identity, service, roster) };
    return reply.send(response);
  });

  app.post('/api/session/import', async (request, reply) => {
    requireTeacher(request.identity);
    const body = ImportRequestSchema.parse(request.body ?? {});
    await service.importQuestions(body);
    return reply.send(teacherView());
  });

  app.post('/api/session/open', async (request, reply) => {
    requireTeacher(request.identity);
    EmptyRequestSchema.parse(request.body ?? {});
    await service.open();
    return reply.send(teacherView());
  });

  app.post('/api/session/close', async (request, reply) => {
    requireTeacher(request.identity);
    EmptyRequestSchema.parse(request.body ?? {});
    await service.close();
    return reply.send(teacherView());
  });

  app.post('/api/session/export', async (request, reply) => {
    requireTeacher(request.identity);
    // 匯出模式由伺服器驗證（002 FR-017）；不正確時回 VALIDATION_FAILED，不讀寫文件
    const body = ExportRequestSchema.safeParse(request.body ?? {});
    if (!body.success) throw new DomainError('VALIDATION_FAILED', '匯出模式不正確。');
    const response: ExportResponse = await service.exportResults(body.data.mode);
    return reply.send(response);
  });
}
