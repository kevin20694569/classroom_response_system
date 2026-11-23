/** 全形數字轉半形（例如「３」→「3」）。 */
export function toHalfWidthDigits(text: string): string {
  return text.replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

/**
 * 依 FR-007a 辨識題號欄的內容：
 * 接受「1」「1.」「1、」「Q1」（大小寫皆可）「第1題」，數字可為半形或全形，前後空白忽略；
 * 空白回傳 "empty"（題目之間的分隔列）；其他內容（含 0、A-1、一）回傳 "invalid"。
 */
export function parseQuestionNumber(raw: string): number | 'empty' | 'invalid' {
  const text = toHalfWidthDigits(raw.trim());
  if (text === '') return 'empty';
  const match = /^(?:(\d+)[.、]?|[Qq](\d+)|第(\d+)題)$/.exec(text);
  const digits = match?.[1] ?? match?.[2] ?? match?.[3];
  if (digits === undefined) return 'invalid';
  const value = Number.parseInt(digits, 10);
  return value > 0 ? value : 'invalid';
}
