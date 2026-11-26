import { ApiErrorBodySchema, type ErrorCode, type ErrorDetail } from '@crs/shared';
import type { z } from 'zod';
import { fileNameFromContentDisposition } from './contentDisposition';
import { getToken } from './identity';

/** API 錯誤：帶有伺服器回傳的錯誤代碼、使用者訊息與位置細節。 */
export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode | 'NETWORK_ERROR',
    message: string,
    readonly details: ErrorDetail[] = [],
    readonly status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
}

/**
 * 呼叫後端 API：自動帶 Authorization: Bearer、以共用 schema 驗證回應（原則 V）。
 */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token !== null) headers.Authorization = `Bearer ${token}`;
  const init: RequestInit = { method: options.method ?? 'GET', headers };
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(path, init);
  } catch {
    throw new ApiError('NETWORK_ERROR', '無法連線到伺服器，請確認系統已啟動。');
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorBodySchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(code, message, details ?? [], response.status);
    }
    throw new ApiError('INTERNAL_ERROR', '系統發生錯誤，請稍後再試。', [], response.status);
  }
  return schema.parse(json);
}

/**
 * 下載檔案（子功能 005）：與 apiRequest 一樣帶 Bearer token、錯誤丟出 ApiError；
 * 完整讀完回應才回傳，所以失敗時不會留下不完整的檔案（FR-014）。
 * fileName 取自 Content-Disposition，沒有時為 null。
 */
export async function apiDownload(path: string): Promise<{ blob: Blob; fileName: string | null }> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token !== null) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(path, { method: 'GET', headers });
  } catch {
    throw new ApiError('NETWORK_ERROR', '無法連線到伺服器，請確認系統已啟動。');
  }

  if (!response.ok) {
    const json: unknown = await response.json().catch(() => null);
    const parsed = ApiErrorBodySchema.safeParse(json);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      throw new ApiError(code, message, details ?? [], response.status);
    }
    throw new ApiError('INTERNAL_ERROR', '系統發生錯誤，請稍後再試。', [], response.status);
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new ApiError('NETWORK_ERROR', '無法連線到伺服器，請確認系統已啟動。');
  }
  return {
    blob,
    fileName: fileNameFromContentDisposition(response.headers.get('Content-Disposition')),
  };
}
