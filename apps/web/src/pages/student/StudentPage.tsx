import { useState } from 'react';
import { ApiError } from '../../api/http';
import { SessionTimer } from '../../components/SessionTimer';
import { useSessionState } from '../../hooks/useSessionState';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import * as AnswerDraftStore from '../../student/answerDraftStore';
import * as NicknameStore from '../../student/nicknameStore';
import { AnswerSheet } from './AnswerSheet';
import { GroupMemberList } from './GroupMemberList';
import { JoinGroupPanel } from './JoinGroupPanel';
import { NicknamePanel } from './NicknamePanel';
import { PhaseBanner } from './PhaseBanner';
import { StudentResultBoard } from './StudentResultBoard';

/**
 * 學生端（003，路徑 /student）：依分頁身分與伺服器推播的檢視切換畫面（data-model §4）。
 * 畫面完全由伺服器的 view 決定，學生端不自行改變活動階段（原則 II）。
 * 004：尚未加入組別時，分頁還沒有暱稱就先顯示暱稱頁（FR-001），確認後才選組；
 * 只有尚未加入時才能修改暱稱（FR-007）。
 */
export function StudentPage() {
  const auth = useStudentAuth();
  const { view, connected } = useSessionState(auth.token, auth.onInvalidated);
  const [nickname, setNickname] = useState<string | null>(NicknameStore.load);
  const [editingNickname, setEditingNickname] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);

  /** 離開組別失敗時留在組內並說明原因（004 contracts/student-ui.md §3）。 */
  async function leaveGroup() {
    setLeaveError(null);
    try {
      await auth.leave();
    } catch (error) {
      setLeaveError(
        error instanceof ApiError && error.code !== 'NETWORK_ERROR'
          ? error.message
          : '離開組別失敗，請確認連線後再試一次。',
      );
    }
  }

  function confirmNickname(next: string) {
    NicknameStore.save(next);
    setNickname(next);
    setEditingNickname(false);
  }

  // 身分剛改變（加入、離開、失效）時，舊連線的資料還沒換掉，先顯示連線中
  const stale = view !== null && (auth.token === null) !== (view.viewer === 'public');
  if (view === null || stale) {
    return <p className="p-6 text-center text-slate-500">連線中…</p>;
  }

  if (view.viewer === 'teacher') {
    // 以伺服器回傳的檢視類型判斷老師身分，不清除老師 token（FR-008、research R3）
    return (
      <p className="mx-auto mt-16 max-w-md rounded-md bg-amber-50 p-4 text-center text-amber-800">
        這個分頁目前是老師身分，請另開新分頁以學生身分加入。
      </p>
    );
  }

  if (view.viewer === 'public') {
    if (nickname === null || editingNickname) {
      return (
        <NicknamePanel
          // 修改暱稱與第一次進入的初始值不同，切換時重新掛載
          key={editingNickname ? 'edit' : 'new'}
          initial={nickname}
          onConfirm={confirmNickname}
          {...(editingNickname && {
            onCancel: () => {
              setEditingNickname(false);
            },
          })}
        />
      );
    }
    return (
      <JoinGroupPanel
        status={view.status}
        groups={view.groups}
        headcounts={view.headcounts}
        notice={auth.notice}
        nickname={nickname}
        onEditNickname={() => {
          setEditingNickname(true);
        }}
        onJoin={(groupId) => auth.join(groupId, nickname)}
      />
    );
  }

  const { identity } = auth;
  if (identity === null) {
    return <p className="p-6 text-center text-slate-500">連線中…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <PhaseBanner
        groupId={view.groupId}
        nickname={identity.nickname}
        status={view.status}
        connected={connected}
        onLeave={() => {
          void leaveGroup();
        }}
        timer={
          // 與老師端同步的搶答計時（004 FR-029）
          <SessionTimer
            status={view.status}
            openedAt={view.openedAt}
            closedAt={view.closedAt}
            serverNow={view.serverNow}
          />
        }
      />
      {leaveError !== null && (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-red-800">
          {leaveError}
        </p>
      )}
      <GroupMemberList
        groupId={view.groupId}
        members={view.members}
        selfMemberId={identity.memberId}
      />
      {view.status === 'CLOSED' ? (
        <StudentResultBoard
          questions={view.questions}
          results={view.results ?? []}
          ownSubmissions={view.ownSubmissions}
          groupId={view.groupId}
          showUnsentNotice={AnswerDraftStore.hasUnsent(identity.activityId, identity.groupId)}
        />
      ) : (
        <AnswerSheet
          // 換組或換活動時重新掛載，草稿不會帶到別組
          key={`${identity.activityId}.${identity.groupId}`}
          questions={view.questions}
          ownSubmissions={view.ownSubmissions}
          status={view.status}
          connected={connected}
          identity={identity}
          onInvalidated={auth.onInvalidated}
        />
      )}
    </div>
  );
}
