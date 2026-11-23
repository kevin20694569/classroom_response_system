import type { ErrorDetail } from '@crs/shared';

export interface DisplayError {
  message: string;
  details?: readonly ErrorDetail[];
}

function location(detail: ErrorDetail): string {
  const parts: string[] = [];
  if (detail.sheetTitle !== undefined) parts.push(`工作表「${detail.sheetTitle}」`);
  if (detail.row !== undefined) parts.push(`第 ${detail.row} 列`);
  if (detail.column !== undefined) parts.push(`${detail.column} 欄`);
  if (detail.questionNumber !== undefined) parts.push(`第 ${detail.questionNumber} 題`);
  if (detail.blankIndex !== undefined) parts.push(`子題（${detail.blankIndex}）`);
  return parts.join('、');
}

/** 顯示錯誤訊息；有位置細節時以清單列出（工作表、列、欄、題號）。 */
export function ErrorBanner({ error }: { error: DisplayError | null }) {
  if (error === null) return null;
  return (
    <div
      role="alert"
      className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800"
    >
      <p className="font-medium">{error.message}</p>
      {error.details !== undefined && error.details.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {error.details.map((detail, i) => {
            const where = location(detail);
            return (
              <li key={i}>
                {where !== '' && <span className="font-medium">{where}：</span>}
                {detail.message}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
