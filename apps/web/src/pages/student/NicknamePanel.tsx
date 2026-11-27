import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_RULE_MESSAGE,
  NicknameSchema,
  unicodeLength,
} from '@crs/shared';
import { useId, useState, type SyntheticEvent } from 'react';
import { randomNickname } from '../../student/randomNickname';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/icons';
import { INPUT, MUTED } from '../../ui/styles';

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
      <div className="flex flex-col items-center gap-2 text-center">
        <span className="ui-anim grid size-14 animate-float place-items-center rounded-2xl bg-gradient-to-br from-emerald-700 to-teal-700 text-white shadow-card">
          <Icon name="nickname" size={30} />
        </span>
        <h1 className="text-3xl font-black text-ink">輸入你的暱稱</h1>
        <p className="text-ink-muted">暱稱會顯示給同組同學與老師。</p>
      </div>
      <form onSubmit={confirm} className="ui-card space-y-3 p-5">
        <label htmlFor={inputId} className="block text-sm font-bold text-ink">
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
            className={`${INPUT} mt-0 min-w-0 flex-1 text-lg font-bold`}
            autoComplete="off"
            aria-invalid={error !== null}
          />
          <Button
            variant="secondary"
            onClick={() => {
              setValue(randomNickname(value));
              setError(null);
            }}
          >
            <Icon name="shuffle" size={16} />
            換一個
          </Button>
        </div>
        <p className={`text-right ${MUTED}`}>
          {unicodeLength(value.trim())} / {NICKNAME_MAX_LENGTH}
        </p>
        {error !== null && (
          <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm font-semibold text-red-800">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          {onCancel !== undefined && (
            <Button variant="secondary" onClick={onCancel}>
              取消
            </Button>
          )}
          <Button variant="primary" size="lg" type="submit">
            確認
          </Button>
        </div>
      </form>
    </main>
  );
}
