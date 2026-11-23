import { useState, type SyntheticEvent } from 'react';
import { ApiError } from '../../api/http';
import { ErrorBanner, type DisplayError } from '../../components/ErrorBanner';

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
    <main className="mx-auto mt-24 max-w-sm rounded-xl bg-white p-8 shadow">
      <h1 className="text-xl font-bold">老師登入</h1>
      <p className="mt-1 text-sm text-slate-500">請輸入老師端密碼。</p>
      <form className="mt-6 space-y-4" onSubmit={(e) => void handleSubmit(e)}>
        <label className="block text-sm font-medium">
          密碼
          <input
            type="password"
            autoComplete="current-password"
            className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
            }}
            required
          />
        </label>
        <ErrorBanner error={error} />
        <button
          type="submit"
          disabled={submitting || password === ''}
          className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {submitting ? '登入中…' : '登入'}
        </button>
      </form>
    </main>
  );
}
