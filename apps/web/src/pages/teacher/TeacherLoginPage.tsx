import { useState, type SyntheticEvent } from 'react';
import { ApiError } from '../../api/http';
import { ErrorBanner, type DisplayError } from '../../components/ErrorBanner';
import { Button } from '../../ui/Button';
import { Icon } from '../../ui/icons';
import { INPUT, MUTED } from '../../ui/styles';

/** 老師密碼登入（FR-003）。密碼錯誤時顯示伺服器訊息，不透露任何密碼資訊。 */
export function TeacherLoginPage({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<DisplayError | null>(null);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onLogin(password);
    } catch (e) {
      setError(
        e instanceof ApiError ? { message: e.message } : { message: '登入失敗，請稍後再試。' },
      );
      setSubmitting(false);
    }
  };

  return (
    <main className="ui-card mx-auto mt-24 max-w-sm p-8">
      <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-700 text-white">
        <Icon name="login" size={26} />
      </span>
      <h1 className="text-2xl font-black text-ink">老師登入</h1>
      <p className={`mt-1 ${MUTED}`}>請輸入老師端密碼。</p>
      <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <label className="block text-sm font-bold text-ink">
          密碼
          <input
            type="password"
            autoComplete="current-password"
            className={INPUT}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            required
          />
        </label>
        <ErrorBanner error={error} />
        <Button
          variant="primary"
          size="lg"
          type="submit"
          pending={submitting}
          disabled={password === ''}
          className="w-full"
        >
          {submitting ? '登入中…' : '登入'}
        </Button>
      </form>
    </main>
  );
}
