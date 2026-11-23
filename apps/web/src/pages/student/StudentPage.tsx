import type { StudentView } from '@crs/shared';
import { useSessionState } from '../../hooks/useSessionState';
import { useStudentAuth } from '../../hooks/useStudentAuth';
import { JoinGroupPanel } from './JoinGroupPanel';
import { PhaseBanner } from './PhaseBanner';

/** 各階段的內容；US2、US3 換成作答與結果元件。 */
function PhaseContent({ view }: { view: StudentView }) {
  if (view.status === 'READY') return <p className="text-slate-600">等待老師開啟搶答</p>;
  if (view.status === 'OPEN') return <p className="text-slate-600">搶答進行中</p>;
  return <p className="text-slate-600">搶答已結束</p>;
}

/**
 * 學生端（003，路徑 /student）：依分頁身分與伺服器推播的檢視切換畫面（data-model §4）。
 * 畫面完全由伺服器的 view 決定，學生端不自行改變活動階段（原則 II）。
 */
export function StudentPage() {
  const auth = useStudentAuth();
  const { view, connected } = useSessionState(auth.token, auth.onInvalidated);

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
    return (
      <JoinGroupPanel
        status={view.status}
        groups={view.groups}
        notice={auth.notice}
        onJoin={auth.join}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <PhaseBanner
        groupId={view.groupId}
        status={view.status}
        connected={connected}
        onLeave={auth.leave}
      />
      <PhaseContent view={view} />
    </div>
  );
}
