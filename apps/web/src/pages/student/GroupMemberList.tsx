import type { GroupId, GroupMember } from '@crs/shared';
import { useId } from 'react';
import { GroupBadge } from '../../ui/GroupBadge';
import { groupIdentity } from '../../ui/groupIdentity';

export interface GroupMemberListProps {
  /** 本組組別，用於本組顏色邊條與標記（007 FR-009、FR-009a） */
  groupId: GroupId;
  /** 本組成員，伺服器已依加入先後排列 */
  members: readonly GroupMember[];
  /** 本分頁的組員身分，用來標示「（你）」 */
  selfMemberId: string;
}

/**
 * 本組成員名單（004 FR-010、contracts/student-ui.md §3）：作答與結果畫面都顯示。
 * 暱稱相同的成員分別列出；人數多時換行排列、不截斷。
 * 007：標題前有本組顏色＋圖示的標記，卡片左側為本組顏色邊條；組名由正上方的頂端列顯示，這裡不重複。
 */
export function GroupMemberList({ groupId, members, selfMemberId }: GroupMemberListProps) {
  const headingId = useId();
  const { color } = groupIdentity(groupId);
  return (
    <section
      aria-labelledby={headingId}
      style={{ borderLeftColor: color }}
      className="ui-card border-l-8 p-4"
    >
      <h2 id={headingId} className="flex items-center gap-2 text-sm font-bold text-ink">
        <GroupBadge groupId={groupId} size="sm" showName={false} />
        本組成員（{members.length} 人）
      </h2>
      <ul className="mt-2 flex flex-wrap gap-2">
        {members.map((member) => (
          <li
            key={member.memberId}
            className={`rounded-full px-3 py-1 text-sm break-words [overflow-wrap:anywhere] ${
              member.memberId === selfMemberId
                ? 'bg-violet-100 font-bold text-violet-900'
                : 'bg-slate-100 text-ink'
            }`}
          >
            {member.nickname}
            {member.memberId === selfMemberId && '（你）'}
          </li>
        ))}
      </ul>
    </section>
  );
}
