import { AuthResponseSchema } from '@crs/shared';
import { useCallback, useState } from 'react';
import { apiRequest } from '../api/http';
import { clearToken, getToken, setToken } from '../api/identity';

export interface TeacherAuth {
  token: string | null;
  login: (password: string) => Promise<void>;
  logout: () => void;
}

/** 老師身分：密碼登入後 token 只存在本分頁的 sessionStorage（FR-003a）。 */
export function useTeacherAuth(): TeacherAuth {
  const [token, setTokenState] = useState<string | null>(() => getToken());

  const login = useCallback(async (password: string) => {
    const result = await apiRequest('/api/auth/teacher', AuthResponseSchema, {
      method: 'POST',
      body: { password },
    });
    setToken(result.token);
    setTokenState(result.token);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
  }, []);

  return { token, login, logout };
}
