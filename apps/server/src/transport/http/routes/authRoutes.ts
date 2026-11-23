import {
  StudentJoinRequestSchema,
  TeacherLoginRequestSchema,
  type AuthResponse,
} from '@crs/shared';
import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../../../auth/authService.js';
import type { QuizSessionService } from '../../../domain/session/quizSessionService.js';

/** 身分 API（contracts/http-api.md「身分」）。 */
export function registerAuthRoutes(
  app: FastifyInstance,
  auth: AuthService,
  service: QuizSessionService,
): void {
  app.post('/api/auth/teacher', (request, reply) => {
    const body = TeacherLoginRequestSchema.parse(request.body ?? {});
    const response: AuthResponse = auth.loginAsTeacher(body.password);
    return reply.send(response);
  });

  /** 學生加入組別（003 學生端與模擬腳本使用）。 */
  app.post('/api/auth/student', (request, reply) => {
    const body = StudentJoinRequestSchema.parse(request.body ?? {});
    const response: AuthResponse = auth.joinAsStudent(body.groupId, service.getSession());
    return reply.send(response);
  });
}
