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
import { Button } from '../../ui/Button';
import { SectionHeading } from '../../ui/SectionHeading';
import { CARD, INPUT, MUTED, SUCCESS_TEXT } from '../../ui/styles';

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
    <section aria-label="匯入題目" className={`space-y-3 ${CARD}`}>
      <SectionHeading icon="notImported">匯入 Guided Notes</SectionHeading>
      <form className="space-y-3" onSubmit={(e) => void handleSubmit(e)}>
        <label className="block text-sm font-bold text-ink">
          Google Sheets 網址
          <input
            type="url"
            className={INPUT}
            placeholder="https://docs.google.com/spreadsheets/d/…"
            value={url}
            disabled={isOpen}
            onChange={(e) => {
              setUrl(e.target.value);
            }}
            required
          />
        </label>
        <label className="block text-sm font-bold text-ink">
          組數（{MIN_GROUPS}～{MAX_GROUPS}）
          <input
            type="number"
            min={MIN_GROUPS}
            max={MAX_GROUPS}
            className={`${INPUT} max-w-32`}
            value={groupCount}
            disabled={isOpen}
            onChange={(e) => {
              setGroupCount(Number(e.target.value));
            }}
            required
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant={view.status === 'CLOSED' ? 'danger' : 'primary'}
            type="submit"
            pending={submitting}
            disabled={isOpen || url.trim() === ''}
          >
            {submitting ? '匯入中…' : view.status === 'NOT_IMPORTED' ? '匯入' : '重新匯入'}
          </Button>
          {view.status === 'READY' && (
            <span className="text-sm font-semibold text-amber-800">{READY_REIMPORT_NOTICE}</span>
          )}
          {isOpen && <span className={MUTED}>搶答進行中不能匯入，請先結束搶答。</span>}
        </div>
      </form>
      {notice !== null && <p className={SUCCESS_TEXT}>{notice}</p>}
      <ErrorBanner error={error} />
    </section>
  );
}
