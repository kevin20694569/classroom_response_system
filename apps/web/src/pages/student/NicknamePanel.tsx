import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_RULE_MESSAGE,
  NicknameSchema,
  unicodeLength,
} from '@crs/shared';
import { useId, useState, type SyntheticEvent } from 'react';
import { randomNickname } from '../../student/randomNickname';

export interface NicknamePanelProps {
  /** 目前的暱稱；第一次進入時為 null（預填隨機名字），修改暱稱時為目前的暱稱 */
  initial: string | null;
  /** 確認後回傳去除前後空白的暱稱 */
  onConfirm: (nickname: string) => void;
  /** 修改暱稱時可取消，回到選組畫面 */
  onCancel?: () => void;
}

/**
 * 暱稱頁（004 US1、contracts/student-ui.md §1）：預填隨機的短英文名字，可「換一個」或自行修改。
 * 規則與伺服器共用 NicknameSchema（原則 V）；暱稱可以和別人重複（FR-005）。
 */
export function NicknamePanel({ initial, onConfirm, onCancel }: NicknamePanelProps) {
  const [value, setValue] = useState(() => initial ?? randomNickname());
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();

  function confirm(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = NicknameSchema.safeParse(value);
    if (!parsed.success) {
      setError(NICKNAME_RULE_MESSAGE);
      return;
    }
    onConfirm(parsed.data);
  }

  return (
    <main className="mx-auto mt-16 max-w-md space-y-4 p-6">
      <h1 className="text-center text-2xl font-bold">輸入你的暱稱</h1>
      <p className="text-center text-slate-600">暱稱會顯示給同組同學與老師。</p>
      <form onSubmit={confirm} className="space-y-3 rounded-xl bg-white p-4 shadow">
        <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
          暱稱
        </label>
        <div className="flex items-center gap-2">
          <input
            id={inputId}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setError(null);
            }}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2"
            autoComplete="off"
            aria-invalid={error !== null}
          />
          <button
            type="button"
            onClick={() => {
              setValue(randomNickname(value));
              setError(null);
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-slate-700"
          >
            換一個
          </button>
        </div>
        <p className="text-right text-xs text-slate-500">
          {unicodeLength(value.trim())} / {NICKNAME_MAX_LENGTH}
        </p>
        {error !== null && (
          <p role="alert" className="rounded-md bg-red-50 p-2 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {onCancel !== undefined && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-md px-4 py-2 text-slate-600"
            >
              取消
            </button>
          )}
          <button
            type="submit"
            className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white"
          >
            確認
          </button>
        </div>
      </form>
    </main>
  );
}
