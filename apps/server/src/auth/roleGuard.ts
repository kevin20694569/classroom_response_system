import { DomainError } from '../domain/errors.js';
import type { StudentIdentity, TabIdentity, TeacherIdentity } from './tokens.js';

/**
 * 角色權限檢查（FR-002）：在伺服器端強制執行，不依賴前端隱藏按鈕。
 * 未登入 → UNAUTHORIZED；角色不符 → FORBIDDEN。
 */
export function requireTeacher(identity: TabIdentity | null): TeacherIdentity {
  if (identity === null) {
    throw new DomainError('UNAUTHORIZED', '請先以老師身分登入。');
  }
  if (identity.role !== 'teacher') {
    throw new DomainError('FORBIDDEN', '只有老師可以執行這個操作。');
  }
  return identity;
}

export function requireStudent(identity: TabIdentity | null): StudentIdentity {
  if (identity === null) {
    throw new DomainError('UNAUTHORIZED', '請先選擇組別加入。');
  }
  if (identity.role !== 'student') {
    throw new DomainError('FORBIDDEN', '只有學生可以送出答案。');
  }
  return identity;
}
