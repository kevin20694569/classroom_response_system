import type { SessionView } from '@crs/shared';
import type { TabIdentity } from '../auth/tokens.js';
import type { RosterReader } from '../domain/roster/groupRoster.js';
import type { QuizSessionService } from '../domain/session/quizSessionService.js';
import {
  toPublicView,
  toStudentView,
  toTeacherView,
} from '../domain/visibility/visibilityPolicy.js';

/** 依身分產生檢視資料（HTTP 與即時推播共用，確保兩邊的可見性規則一致）。 */
export function viewFor(
  identity: TabIdentity | null,
  service: QuizSessionService,
  roster: RosterReader,
): SessionView {
  const session = service.getSession();
  const ranking = service.deps.ranking;
  if (identity === null) return toPublicView(session, roster);
  if (identity.role === 'teacher')
    return toTeacherView(session, ranking, roster, service.deps.now());
  return toStudentView(session, identity.groupId, ranking, roster, service.deps.now());
}
