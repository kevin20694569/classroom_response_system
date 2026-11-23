import { describe, expect, it } from 'vitest';
import { readBlankMarker } from '../../src/domain/guidedNotes/markers.js';

describe('readBlankMarker', () => {
  it.each([
    ['（1）', '（1）', 1],
    ['(2)', '(2)', 2],
    ['（ ３ ）', '（ ３ ）', 3],
    ['（1）CPU', '（1）', 1],
    ['  (12) 舊答案', '(12)', 12],
  ])('「%s」→ 標記「%s」、%i', (text, label, number) => {
    expect(readBlankMarker(text)).toEqual({ label, number });
  });

  it.each(['', 'CPU', '1)', '（一）', '答案（1）'])('「%s」→ 沒有標記', (text) => {
    expect(readBlankMarker(text)).toBeNull();
  });
});
