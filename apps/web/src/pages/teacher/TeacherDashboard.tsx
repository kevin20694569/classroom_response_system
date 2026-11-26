import { QuestionList } from '../../components/QuestionList';
import { StatusBadge } from '../../components/StatusBadge';
import { useSessionState } from '../../hooks/useSessionState';
import { CsvExportPanel } from './CsvExportPanel';
import { ExportPanel } from './ExportPanel';
import { ImportPanel } from './ImportPanel';
import { SessionControls } from './SessionControls';
import { SubmissionBoard } from './SubmissionBoard';

/** 老師端主畫面：即時狀態、題目、活動控制、作答狀況、匯出。 */
export function TeacherDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const { view, connected } = useSessionState(token, onLogout);

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">課堂搶答 — 老師端</h1>
          {view !== null && <StatusBadge status={view.status} />}
          {!connected && <span className="text-sm text-slate-500">連線中…</span>}
        </div>
        <button type="button" className="text-sm text-slate-600 underline" onClick={onLogout}>
          登出
        </button>
      </header>
      {view?.viewer === 'teacher' && (
        <>
          <ImportPanel view={view} />
          <section aria-label="題目" className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-3 text-lg font-semibold">題目</h2>
            {/* 重新匯入（activityId 改變）時重新掛載，預覽自動清除（002 FR-008） */}
            <QuestionList key={view.activityId ?? 'none'} view={view} />
          </section>
          <SessionControls view={view} />
          <SubmissionBoard view={view} />
          <ExportPanel view={view} />
          <CsvExportPanel view={view} />
        </>
      )}
    </div>
  );
}
