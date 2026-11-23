import {
  MAX_GROUPS,
  MIN_GROUPS,
  TeacherViewResponseSchema,
  type ImportRequest,
  type TeacherView,
} from '@crs/shared';
import { useState, type SyntheticEvent } from 'react';
import { ApiError, apiRequest } from '../../api/http';
import { ErrorBanner, type DisplayError } from '../../components/ErrorBanner';

export const CLOSED_CONFIRM_MESSAGE =
  '重新匯入會開始新的一場，目前結果將被清除，請確認已匯出。確定要重新匯入嗎？';
export const READY_REIMPORT_NOTICE = '重新匯入會開始新的一場，已加入的學生需重新選擇組別加入。';

/** 匯入 Guided Notes（US1）：貼上 Google Sheets 網址並設定組數。 */
export function ImportPanel({ view }: { view: TeacherView }) {
  const [url, setUrl] = useState('');
  const [groupCount, setGroupCount] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<DisplayError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const isOpen = view.status === 'OPEN';

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body: ImportRequest = { spreadsheetUrl: url, groupCount };
    if (view.status === 'CLOSED') {
      if (!window.confirm(CLOSED_CONFIRM_MESSAGE)) return;
      body.confirmDiscard = true;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiRequest('/api/session/import', TeacherViewResponseSchema, {
        method: 'POST',
        body,
      });
      setNotice(
        `已匯入 ${result.view.questions.length} 題（工作表「${result.view.source?.sheetTitle ?? ''}」）。`,
      );
    } catch (e) {
      setError(
        e instanceof ApiError
          ? { message: e.message, details: e.details }
          : { message: '匯入失敗，請稍後再試。' },
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section aria-label="匯入題目" className="space-y-3 rounded-xl bg-white p-5 shadow">
      <h2 className="text-lg font-semibold">匯入 Guided Notes</h2>
      <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
        <label className="block text-sm font-medium">
          Google Sheets 網址
          <input
            type="url"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={url}
            disabled={isOpen}
            onChange={(e) => {
              setUrl(e.target.value);
            }}
            required
          />
        </label>
        <label className="block text-sm font-medium">
          組數（{MIN_GROUPS}～{MAX_GROUPS}）
          <input
            type="number"
            min={MIN_GROUPS}
            max={MAX_GROUPS}
            className="mt-1 w-32 rounded-md border border-slate-300 px-3 py-2"
            value={groupCount}
            disabled={isOpen}
            onChange={(e) => {
              setGroupCount(Number(e.target.value));
            }}
            required
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isOpen || submitting || url.trim() === ''}
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {submitting ? '匯入中…' : view.status === 'NOT_IMPORTED' ? '匯入' : '重新匯入'}
          </button>
          {view.status === 'READY' && (
            <span className="text-sm text-amber-700">{READY_REIMPORT_NOTICE}</span>
          )}
          {isOpen && (
            <span className="text-sm text-slate-500">搶答進行中不能匯入，請先結束搶答。</span>
          )}
        </div>
      </form>
      {notice !== null && <p className="text-sm text-green-700">{notice}</p>}
      <ErrorBanner error={error} />
    </section>
  );
}
