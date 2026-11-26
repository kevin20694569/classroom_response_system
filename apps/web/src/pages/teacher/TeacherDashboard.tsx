import { QuestionList } from '../../components/QuestionList';
import { StatusBadge } from '../../components/StatusBadge';
import { useSessionState } from '../../hooks/useSessionState';
import { useWideLayout } from '../../hooks/useWideLayout';
import { CsvExportPanel } from './CsvExportPanel';
import { ExportPanel } from './ExportPanel';
import { GroupOverviewPanel } from './GroupOverviewPanel';
import { GroupOverviewToggle } from './GroupOverviewToggle';
import { ImportPanel } from './ImportPanel';
import { SessionControls } from './SessionControls';
import { SubmissionBoard } from './SubmissionBoard';

/**
 * 老師端主畫面：即時狀態、題目、活動控制、作答狀況、匯出，以及「分組情況」（006）。
 * 視窗寬度 ≥ 1600 px：主畫面（最寬 1024 px）在視窗中置中；分組情況的框架為主畫面右緣到視窗右緣之間的區域，
 * 固定在視窗中、不隨主畫面捲動，面板在框架內水平置中，內容多時框架內捲動（FR-011、FR-013）。
 * 較窄：主畫面右側保留一欄給右上角的浮動按鈕，按下後展開抽屜（FR-012）；跨過門檻立即切換（FR-014）。
 */
export function TeacherDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const { view, connected } = useSessionState(token, onLogout);
  const wide = useWideLayout();
  const teacherView = view?.viewer === 'teacher' ? view : null;

  const main = (
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
      {teacherView !== null && (
        <>
          <ImportPanel view={teacherView} />
          <section aria-label="題目" className="rounded-xl bg-white p-5 shadow">
            <h2 className="mb-3 text-lg font-semibold">題目</h2>
            {/* 重新匯入（activityId 改變）時重新掛載，預覽自動清除（002 FR-008） */}
            <QuestionList key={teacherView.activityId ?? 'none'} view={teacherView} />
          </section>
          <SessionControls view={teacherView} />
          <SubmissionBoard view={teacherView} />
          <ExportPanel view={teacherView} />
          <CsvExportPanel view={teacherView} />
        </>
      )}
    </div>
  );

  if (wide) {
    return (
      <>
        {/* 主畫面維持 max-w-5xl（1024 px）並在視窗中置中，不為分組情況讓出寬度 */}
        <main>{main}</main>
        {teacherView !== null && (
          // 框架：左緣 = 視窗中線 + 主畫面半寬（32rem）= 主畫面右緣，右緣 = 視窗右緣；固定在視窗中。
          // 兩側都預留捲軸空間，內容多出現捲軸時面板仍左右對稱置中
          <aside
            aria-label="分組情況"
            className="fixed top-0 right-0 bottom-0 left-[calc(50%+32rem)] overflow-y-auto overscroll-contain px-4 pt-6 pb-12 [scrollbar-gutter:stable_both-edges]"
          >
            {/* 浮起的卡片：細外框＋向下的柔和陰影；陰影橫向延伸不超過框架兩側留白，不會被捲動容器切掉 */}
            <div className="mx-auto w-full max-w-xs rounded-2xl bg-white p-5 shadow-[0_16px_32px_-12px_rgba(15,23,42,0.28),0_4px_10px_-4px_rgba(15,23,42,0.12)] ring-1 ring-slate-900/5">
              <GroupOverviewPanel view={teacherView} />
            </div>
          </aside>
        )}
      </>
    );
  }

  return (
    <>
      {/* 右側保留一欄給浮動按鈕，捲動到任何位置都不會蓋住主畫面的按鈕或文字（FR-012） */}
      <main className="pr-28">{main}</main>
      {teacherView !== null && <GroupOverviewToggle view={teacherView} />}
    </>
  );
}
