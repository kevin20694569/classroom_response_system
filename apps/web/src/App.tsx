import { TeacherPage } from './pages/teacher/TeacherPage';

function HomePage() {
  return (
    <main className="mx-auto mt-24 max-w-md space-y-4 text-center">
      <h1 className="text-2xl font-bold">課堂搶答系統</h1>
      <a
        href="/teacher"
        className="block rounded-md bg-indigo-600 px-4 py-3 font-medium text-white"
      >
        老師端
      </a>
      <p className="rounded-md bg-slate-100 px-4 py-3 text-slate-500">學生端（子功能 002 提供）</p>
    </main>
  );
}

/** 依路徑切換頁面：/teacher 為老師端（001），/student 為學生端（002 預留）。 */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/teacher') return <TeacherPage />;
  if (path === '/') return <HomePage />;
  return <p className="p-6 text-center text-slate-500">找不到這個頁面。</p>;
}
