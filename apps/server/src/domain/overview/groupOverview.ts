import type {
  GroupOverview,
  MemberAnswerTag,
  OverviewMember,
  QuestionResult,
  QuizSession,
  Submission,
} from '@crs/shared';
import type { RosterReader } from '../roster/groupRoster.js';

/** 不在組內的送出者，其送出紀錄沒有暱稱時的顯示文字（004 之前的資料才可能發生）。 */
export const UNKNOWN_NICKNAME = '（未記錄暱稱）';

/** 同一位送出者在某組的送出紀錄（依 sequence 排序）。 */
interface SubmitterRecords {
  memberId: string;
  submissions: Submission[];
}

/** 依送出者身分分組；沒有身分的舊紀錄（006 之前）略過，不標註到任何人（FR-008）。 */
function bySubmitter(submissions: readonly Submission[]): Map<string, SubmitterRecords> {
  const map = new Map<string, SubmitterRecords>();
  for (const s of [...submissions].sort((a, b) => a.sequence - b.sequence)) {
    if (s.submitterMemberId === null) continue;
    const records = map.get(s.submitterMemberId);
    if (records === undefined) {
      map.set(s.submitterMemberId, { memberId: s.submitterMemberId, submissions: [s] });
    } else {
      records.submissions.push(s);
    }
  }
  return map;
}

/** 題號標註：依題號由小到大；搶答成功以既有的 deriveResults 判定（FR-007、FR-010）。 */
function tagsOf(
  records: SubmitterRecords | undefined,
  winnerIds: ReadonlySet<string>,
): MemberAnswerTag[] {
  if (records === undefined) return [];
  return records.submissions
    .map((s) => ({ questionNumber: s.questionNumber, isWinner: winnerIds.has(s.id) }))
    .sort((a, b) => a.questionNumber - b.questionNumber);
}

/**
 * 老師端「分組情況」的資料（006 research R2、R4、R5）：合併組員名冊、送出紀錄與每題搶答結果。
 *
 * 業務規則：
 * - 依活動的組別順序列出每一組；尚未匯入（沒有組別）時為空陣列（FR-002、FR-004）。
 * - 在組內的組員取自名冊，依加入先後排列；「在組內」的判定與人數與學生端完全相同（FR-003）。
 * - 組員所有分頁都斷線、仍在 30 秒緩衝期時標示 disconnected（「連線中斷」），仍計入人數（FR-021）。
 * - 題號標註依送出紀錄的送出者身分對應，不依暱稱（同組可能同名，FR-008）。
 * - 送出過題目、但已不在名冊的身分仍列在該組最後（多位時依各自第一筆送出的先後），暱稱取第一筆送出記錄的暱稱，
 *   不計入人數；重新回到名冊後恢復為一般組員（FR-009）。
 *   一位學生的送出一定屬於他 token 的組別，且離開組別只在「待開始」，所以同一身分不會出現在兩組。
 *
 * 純函式：不依賴傳輸層，只由可見性政策在產生老師檢視時呼叫（原則 IV、FR-016）。
 */
export function buildGroupOverview(
  session: QuizSession,
  roster: RosterReader,
  results: readonly QuestionResult[],
): GroupOverview[] {
  const winnerIds = new Set(results.flatMap((r) => (r.winner === null ? [] : [r.winner.id])));
  return session.groups.map((group) => {
    const submitters = bySubmitter(session.submissions.filter((s) => s.groupId === group.id));

    const inGroup: OverviewMember[] = roster.membersOf(group.id).map((m) => ({
      memberId: m.memberId,
      nickname: m.nickname,
      inGroup: true,
      disconnected: roster.isInGrace(m.memberId),
      answered: tagsOf(submitters.get(m.memberId), winnerIds),
    }));
    const inGroupIds = new Set(inGroup.map((m) => m.memberId));

    // Map 依插入順序迭代，bySubmitter 已依 sequence 排序，因此這裡就是「第一筆送出的先後」
    const absent: OverviewMember[] = [...submitters.values()]
      .filter((records) => !inGroupIds.has(records.memberId))
      .map((records) => ({
        memberId: records.memberId,
        nickname: records.submissions[0]?.submitterNickname ?? UNKNOWN_NICKNAME,
        inGroup: false,
        disconnected: false,
        answered: tagsOf(records, winnerIds),
      }));

    return { groupId: group.id, memberCount: inGroup.length, members: [...inGroup, ...absent] };
  });
}
