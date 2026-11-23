import {
  StudentJoinRequestSchema,
  TeacherLoginRequestSchema,
  type AuthResponse,
} from '@crs/shared';
import type { FastifyInstance } from 'fastify';
import type { AuthService } from '../../../auth/authService.js';
import { DomainError } from '../../../domain/errors.js';
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

  /**
   * 學生加入組別（003 學生端與模擬腳本使用）。
   * 加入成功與被拒的原因寫入結構化 log（003 FR-028）；log 不含 token。
   */
  app.post('/api/auth/student', (request, reply) => {
    const body = StudentJoinRequestSchema.parse(request.body ?? {});
    let response: AuthResponse;
    try {
      response = auth.joinAsStudent(body.groupId, service.getSession());
    } catch (error) {
      request.log.info(
        {
          event: 'student.join.rejected',
          groupId: body.groupId,
          code: error instanceof DomainError ? error.code : 'INTERNAL_ERROR',
        },
        '拒絕學生加入',
      );
      throw error;
    }
    if (response.identity.role === 'student') {
      request.log.info(
        {
          event: 'student.joined',
          groupId: response.identity.groupId,
          activityId: response.identity.activityId,
        },
        '學生加入組別',
      );
    }
    return reply.send(response);
  });
}
