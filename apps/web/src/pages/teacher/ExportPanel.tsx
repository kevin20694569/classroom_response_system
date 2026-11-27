import {
  DEFAULT_EXPORT_MODE,
  EXPORT_MODE_DESCRIPTION,
  EXPORT_MODE_LABEL,
  ExportModeSchema,
  ExportResponseSchema,
  type ExportMode,
  type TeacherView,
} from '@crs/shared';
import { useState } from 'react';
import { ApiError, apiRequest } from '../../api/http';
import { ErrorBanner, type DisplayError } from '../../components/ErrorBanner';
import { Button } from '../../ui/Button';
import { SectionHeading } from '../../ui/SectionHeading';
import { CARD, MUTED, SUCCESS_TEXT } from '../../ui/styles';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('zh-TW', { hour12: false });
}

const MODES: readonly ExportMode[] = ExportModeSchema.options;

/**
 * 匯出至原 Guided Notes（US4；002 匯出模式）：只在搶答結束後啟用，可重複執行。
 * 匯出模式每次掛載都預設「只有答案」、不記憶，避免在老師沒注意時改動文件版面（002 spec Assumptions）。
 */
export function ExportPanel({ view }: { view: TeacherView }) {
  const [mode, setMode] = useState<ExportMode>(DEFAULT_EXPORT_MODE);
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
        body: { mode },
      });
      const label = EXPORT_MODE_LABEL[result.mode];
      setMessage(
        result.writtenQuestionCount === 0
          ? `沒有可匯出的答案（每一題都無人搶答）。（${label}）`
          : `已寫入 ${String(result.writtenQuestionCount)} 題、${String(result.writtenCellCount)} 格（${label}，${formatTime(result.exportedAt)}）。`,
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
    <section aria-label="匯出" className={`space-y-3 ${CARD}`}>
      <SectionHeading icon="export">匯出至原 Guided Notes</SectionHeading>
      <fieldset className="space-y-2" disabled={!canExport || busy}>
        <legend className="text-sm font-bold text-ink">匯出模式</legend>
        {MODES.map((value) => (
          <label
            key={value}
            className="flex items-start gap-2 rounded-xl border-2 border-transparent p-2 text-sm has-[:checked]:border-violet-300 has-[:checked]:bg-violet-50"
          >
            <input
              type="radio"
              name="export-mode"
              value={value}
              checked={mode === value}
              onChange={() => {
                setMode(value);
              }}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="font-bold text-ink">{EXPORT_MODE_LABEL[value]}</span>
              <span className="block text-ink-muted">{EXPORT_MODE_DESCRIPTION[value]}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          pending={busy}
          disabled={!canExport}
          onClick={() => void handleExport()}
        >
          {busy ? '匯出中…' : '匯出答案'}
        </Button>
        {!canExport && <span className={MUTED}>結束搶答後才能匯出。</span>}
        {view.lastExport !== null && (
          <span className={MUTED}>
            上次匯出：{formatTime(view.lastExport.exportedAt)}（
            {view.lastExport.writtenQuestionCount} 題，{EXPORT_MODE_LABEL[view.lastExport.mode]}）
          </span>
        )}
      </div>
      {message !== null && <p className={SUCCESS_TEXT}>{message}</p>}
      <ErrorBanner error={error} />
    </section>
  );
}
