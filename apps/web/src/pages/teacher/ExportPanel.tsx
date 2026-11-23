import { ExportResponseSchema, type TeacherView } from '@crs/shared';
import { useState } from 'react';
import { ApiError, apiRequest } from '../../api/http';
import { ErrorBanner, type DisplayError } from '../../components/ErrorBanner';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', { hour12: false });
}

/** 匯出至原 Guided Notes（US4）：只在搶答結束後啟用，可重複執行。 */
export function ExportPanel({ view }: { view: TeacherView }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<DisplayError | null>(null);
  const canExport = view.status === 'CLOSED';

  const handleExport = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await apiRequest('/api/session/export', ExportResponseSchema, {
        method: 'POST',
        body: {},
      });
      setMessage(
        result.writtenQuestionCount === 0
          ? '沒有可匯出的答案（每一題都無人搶答）。'
          : `已寫入 ${result.writtenQuestionCount} 題、${result.writtenCellCount} 格（${formatTime(result.exportedAt)}）。`,
      );
    } catch (e) {
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: '匯出失敗，請稍後再試。' },
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="匯出" className="space-y-3 rounded-xl bg-white p-5 shadow">
      <h2 className="text-lg font-semibold">匯出至原 Guided Notes</h2>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canExport || busy}
          onClick={() => void handleExport()}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          {busy ? '匯出中…' : '匯出答案'}
        </button>
        {!canExport && <span className="text-sm text-slate-500">結束搶答後才能匯出。</span>}
        {view.lastExport !== null && (
          <span className="text-sm text-slate-600">
            上次匯出：{formatTime(view.lastExport.exportedAt)}（
            {view.lastExport.writtenQuestionCount} 題）
          </span>
        )}
      </div>
      {message !== null && <p className="text-sm text-green-700">{message}</p>}
      <ErrorBanner error={error} />
    </section>
  );
}
