import { lazy, Suspense } from 'react';
import { HomePage } from './pages/HomePage';
import { TeacherPage } from './pages/teacher/TeacherPage';

/**
 * 學生端延遲載入（004 research R1）：隨機名字套件的英文名字資料只有學生端需要，
 * 分成獨立的檔案，老師端與首頁不必下載。
 */
const StudentPage = lazy(async () => {
  const module = await import('./pages/student/StudentPage');
  return { default: module.StudentPage };
});

/** 依路徑切換頁面：/teacher 為老師端（001、002），/student 為學生端（003）。 */
export function App() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/teacher') return <TeacherPage />;
  if (path === '/student') {
    return (
      <Suspense fallback={<p className="p-6 text-center text-slate-500">連線中…</p>}>
        <StudentPage />
      </Suspense>
    );
  }
  if (path === '/') return <HomePage />;
  return <p className="p-6 text-center text-slate-500">找不到這個頁面。</p>;
}
