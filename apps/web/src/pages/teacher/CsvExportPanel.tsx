import { CSV_EXPORT_NOT_CLOSED_MESSAGE, CSV_EXPORT_PATH, type TeacherView } from '@crs/shared';
import { useState } from 'react';
import { ApiError, apiDownload } from '../../api/http';
import { ErrorBanner, type DisplayError } from '../../components/ErrorBanner';
import { saveBlob } from '../../utils/download';

/** 回應沒有檔名時使用的預設檔名 */
const DEFAULT_FILE_NAME = '搶答結果.csv';

/**
 * 匯出結果 CSV（子功能 005）：下載所有組別的送出紀錄，可用 Excel 直接開啟。
 * 與「匯出至原 Guided Notes」互相獨立，不改變該區塊的任何狀態。
 */
export function CsvExportPanel({ view }: { view: TeacherView }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<DisplayError | null>(null);
  const canExport = view.status === 'CLOSED';

  const handleDownload = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const { blob, fileName } = await apiDownload(CSV_EXPORT_PATH);
      const name = fileName ?? DEFAULT_FILE_NAME;
      saveBlob(blob, name);
      setMessage(`已下載 ${name}。`);
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
    <section aria-label="匯出 CSV" className="space-y-3 rounded-xl bg-white p-5 shadow">
      <h2 className="text-lg font-semibold">匯出 CSV</h2>
      <p className="text-sm text-slate-600">下載所有組別的送出紀錄，可用 Excel 直接開啟。</p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canExport || busy}
          onClick={() => void handleDownload()}
          className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-40"
        >
          {busy ? '匯出中…' : '匯出 CSV'}
        </button>
        {!canExport && (
          <span className="text-sm text-slate-500">{CSV_EXPORT_NOT_CLOSED_MESSAGE}</span>
        )}
      </div>
      {message !== null && <p className="text-sm text-green-700">{message}</p>}
      <ErrorBanner error={error} />
    </section>
  );
}
