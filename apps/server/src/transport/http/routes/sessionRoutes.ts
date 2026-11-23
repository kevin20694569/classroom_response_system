import {
  EmptyRequestSchema,
  ImportRequestSchema,
  type ExportResponse,
  type SessionViewResponse,
  type TeacherViewResponse,
} from '@crs/shared';
import type { FastifyInstance } from 'fastify';
import { requireTeacher } from '../../../auth/roleGuard.js';
import type { QuizSessionService } from '../../../domain/session/quizSessionService.js';
import { toTeacherView } from '../../../domain/visibility/visibilityPolicy.js';
import { viewFor } from '../../views.js';

/** 活動狀態與老師專屬操作 API（contracts/http-api.md）。 */
export function registerSessionRoutes(app: FastifyInstance, service: QuizSessionService): void {
  const teacherView = (): TeacherViewResponse => ({
    view: toTeacherView(service.getSession(), service.deps.ranking, service.deps.now()),
  });

  app.get('/api/session', (request, reply) => {
    const response: SessionViewResponse = { view: viewFor(request.identity, service) };
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
    EmptyRequestSchema.parse(request.body ?? {});
    const response: ExportResponse = await service.exportResults();
    return reply.send(response);
  });
}
