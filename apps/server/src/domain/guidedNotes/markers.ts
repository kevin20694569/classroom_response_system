import { toHalfWidthDigits } from './questionNumber.js';

export interface BlankMarker {
  /** 標記原文（保留原本的字形，例如「（1）」或「(1)」） */
  label: string;
  number: number;
}

/**
 * 讀取作答格開頭的子題標記（contracts/guided-notes-format.md §5）：
 * 全形或半形括號、半形或全形數字、括號內可有空白，例如「（1）」「(2)」「（ ３ ）」。
 * 標記後面的文字（佔位符或舊答案）一律忽略。
 */
export function readBlankMarker(text: string): BlankMarker | null {
  const match = /^\s*([（(]\s*([0-9０-９]+)\s*[）)])/.exec(text);
  const label = match?.[1];
  const digits = match?.[2];
  if (label === undefined || digits === undefined) return null;
  return { label, number: Number.parseInt(toHalfWidthDigits(digits), 10) };
}
