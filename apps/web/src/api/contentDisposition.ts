/**
 * 從 Content-Disposition 取出檔名：優先使用 `filename*=UTF-8''…`（可含中文，需百分比解碼），
 * 其次是 `filename="…"`；都沒有或格式錯誤時回傳 null（呼叫端改用預設檔名）。
 */
export function fileNameFromContentDisposition(header: string | null): string | null {
  if (header === null || header === '') return null;

  const encoded = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1];
  if (encoded !== undefined) {
    try {
      const decoded = decodeURIComponent(encoded.trim());
      if (decoded !== '') return decoded;
    } catch {
      // 百分比編碼不合法：略過，改用 filename
    }
  }

  const plain = /filename\s*=\s*"([^"]+)"/i.exec(header)?.[1];
  return plain ?? null;
}
