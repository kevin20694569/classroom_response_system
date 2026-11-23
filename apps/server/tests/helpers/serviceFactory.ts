import { randomUUID } from 'node:crypto';
import type { QuizSession } from '@crs/shared';
import type { DomainLogger } from '../../src/domain/logger.js';
import { FirstSubmissionStrategy } from '../../src/domain/ranking/firstSubmissionStrategy.js';
import { QuizSessionService } from '../../src/domain/session/quizSessionService.js';
import { FakeGuidedNotesGateway } from '../fakes/fakeGuidedNotesGateway.js';
import { InMemorySessionRepository } from '../fakes/inMemorySessionRepository.js';

export const silentLogger: DomainLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export interface ServiceFixture {
  service: QuizSessionService;
  repository: InMemorySessionRepository;
  gateway: FakeGuidedNotesGateway;
}

export async function createService(initial: QuizSession | null = null): Promise<ServiceFixture> {
  const repository = new InMemorySessionRepository(initial);
  const gateway = new FakeGuidedNotesGateway();
  const service = new QuizSessionService({
    repository,
    gateway,
    ranking: new FirstSubmissionStrategy(),
    logger: silentLogger,
    now: () => new Date(),
    uuid: randomUUID,
  });
  await service.init();
  return { service, repository, gateway };
}
