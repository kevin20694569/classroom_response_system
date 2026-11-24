import { SubmitRequestSchema, type SubmitResponse } from '@crs/shared';
import type { FastifyInstance } from 'fastify';
import { requireStudent } from '../../../auth/roleGuard.js';
import type { SubmissionService } from '../../../domain/submission/submissionService.js';

/**
 * 學生送出答案（contracts/http-api.md）：組別與送出者暱稱取自 token；回應不含順位或是否搶答成功（FR-020）。
 * 即時推播只送給老師與送出的那一組（RealtimeGateway 依 submission 變更處理）。
 */
export function registerSubmissionRoutes(
  app: FastifyInstance,
  submissions: SubmissionService,
): void {
  app.post('/api/submissions', async (request, reply) => {
    const identity = requireStudent(request.identity);
    const body = SubmitRequestSchema.parse(request.body ?? {});
    const response: SubmitResponse = await submissions.submit(identity, body);
    return reply.send(response);
  });
}
