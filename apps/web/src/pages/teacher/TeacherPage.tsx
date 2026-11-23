import { useTeacherAuth } from '../../hooks/useTeacherAuth';
import { TeacherDashboard } from './TeacherDashboard';
import { TeacherLoginPage } from './TeacherLoginPage';

/** 老師端：沒有 token 顯示登入頁，有 token 顯示主畫面。 */
export function TeacherPage() {
  const { token, login, logout } = useTeacherAuth();
  if (token === null) return <TeacherLoginPage onLogin={login} />;
  return <TeacherDashboard token={token} onLogout={logout} />;
}
