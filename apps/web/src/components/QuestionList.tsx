import type { TeacherView } from '@crs/shared';

/** 題號清單（FR-008：題目只以題號表示，不顯示題目敘述）。 */
export function QuestionList({ view }: { view: TeacherView }) {
  if (view.questions.length === 0) {
    return <p className="text-sm text-slate-500">尚未匯入題目。</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-600">
        工作表「{view.source?.sheetTitle}」，共 {view.questions.length} 題、{view.groups.length} 組
      </p>
      <ul className="flex flex-wrap gap-2" aria-label="題號清單">
        {view.questions.map((q) => (
          <li
            key={q.number}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1 text-sm"
          >
            第 {q.number} 題
            {q.kind === 'group' && (
              <span className="ml-2 rounded bg-amber-100 px-1.5 text-xs text-amber-800">
                題組（{q.blankCount} 子題）
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
