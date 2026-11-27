import { groupName, type GroupOverview, type OverviewMember, type TeacherView } from '@crs/shared';
import { GroupBadge } from '../../ui/GroupBadge';
import { groupIdentity } from '../../ui/groupIdentity';
import { MemberAnswerTags } from './MemberAnswerTags';

/** 長暱稱在面板寬度內換行，不撐寬面板（006 FR-015）。 */
const WRAP = 'break-words [overflow-wrap:anywhere]';

/**
 * 一位成員：暱稱、狀態標籤與題號標註。
 * 不在組內的送出者整列灰色並標「不在組內」（FR-009）；斷線緩衝中標「連線中斷」（FR-021）。
 */
function MemberRow({ member }: { member: OverviewMember }) {
  return (
    // 007：不在組內改為 slate-500（對比 ≥ 4.5:1，FR-024），並以「不在組內」文字標示，不只靠顏色
    <li data-member={member.nickname} className={`py-1 ${member.inGroup ? '' : 'text-slate-500'}`}>
      <span className={`${WRAP} text-sm ${member.inGroup ? 'font-semibold text-ink' : ''}`}>
        {member.nickname}
      </span>
      {member.disconnected && (
        <span className="ml-2 text-xs font-bold text-orange-700">連線中斷</span>
      )}
      {!member.inGroup && <span className="ml-2 text-xs">不在組內</span>}
      <MemberAnswerTags tags={member.answered} />
    </li>
  );
}

function GroupCard({ group }: { group: GroupOverview }) {
  const label = groupName(group.groupId);
  return (
    <section
      aria-label={label}
      style={{ borderLeftColor: groupIdentity(group.groupId).color }}
      className="rounded-xl border border-l-8 border-slate-200 bg-white p-3 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h3>
          <GroupBadge groupId={group.groupId} size="sm" />
        </h3>
        <span className="text-xs font-bold text-ink-muted">{group.memberCount} 人</span>
      </div>
      {group.members.length === 0 ? (
        <p className="mt-1 text-sm text-ink-muted">尚無組員</p>
      ) : (
        <ul className="mt-1 divide-y divide-slate-100">
          {group.members.map((member) => (
            <MemberRow key={member.memberId} member={member} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 老師端「分組情況」（006 US1、contracts/teacher-ui.md）：每組的標示、人數與組員；
 * 斷線緩衝中的組員以文字「連線中斷」標示（FR-021）。只顯示，不提供任何修改分組的操作（FR-017）。
 * 外層容器（寬螢幕側欄或窄螢幕抽屜）負責定位與捲動，本元件不設高度。
 */
export function GroupOverviewPanel({ view }: { view: TeacherView }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold text-ink">分組情況</h2>
      {view.groups.length === 0 ? (
        <p className="text-sm text-ink-muted">匯入 Guided Notes 後會在這裡顯示各組組員。</p>
      ) : (
        view.groupOverview.map((group) => <GroupCard key={group.groupId} group={group} />)
      )}
    </div>
  );
}
