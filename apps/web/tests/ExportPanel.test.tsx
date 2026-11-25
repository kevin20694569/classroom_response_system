import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExportPanel } from '../src/pages/teacher/ExportPanel';
import { bodyOf, mockFetch } from './helpers';
import { teacherView } from './viewBuilders';

const button = () => screen.getByRole<HTMLButtonElement>('button', { name: '匯出答案' });

describe('ExportPanel（US4）', () => {
  it('只有已結束時才啟用', () => {
    render(<ExportPanel view={teacherView({ status: 'OPEN' })} />);
    expect(button().disabled).toBe(true);
    expect(screen.getByText('結束搶答後才能匯出。')).toBeTruthy();
  });

  it('匯出成功顯示寫入題數與格數', async () => {
    const { calls } = mockFetch([
      {
        status: 200,
        body: {
          mode: 'answers-only',
          writtenQuestionCount: 2,
          writtenCellCount: 3,
          exportedAt: '2026-11-23T08:00:00.000Z',
        },
      },
    ]);
    render(<ExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(button());
    expect(await screen.findByText(/已寫入 2 題、3 格/)).toBeTruthy();
    expect(calls[0]?.url).toBe('/api/session/export');
  });

  it('寫入 0 題時顯示「沒有可匯出的答案」', async () => {
    mockFetch([
      {
        status: 200,
        body: {
          mode: 'answers-only',
          writtenQuestionCount: 0,
          writtenCellCount: 0,
          exportedAt: '2026-11-23T08:00:00.000Z',
        },
      },
    ]);
    render(<ExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(button());
    expect(await screen.findByText(/沒有可匯出的答案/)).toBeTruthy();
  });

  it('無法定位時列出題號', async () => {
    mockFetch([
      {
        status: 422,
        body: {
          error: {
            code: 'EXPORT_LOCATE_FAILED',
            message: '有題目在文件中無法定位，為避免寫錯位置，這次沒有寫入任何內容。',
            details: [{ code: 'QUESTION_NOT_LOCATED', message: '找不到這一題', questionNumber: 3 }],
          },
        },
      },
    ]);
    render(<ExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(button());
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('無法定位');
    expect(alert.textContent).toContain('第 3 題');
  });

  it('顯示上次匯出時間', () => {
    render(
      <ExportPanel
        view={teacherView({
          status: 'CLOSED',
          lastExport: {
            exportedAt: '2026-11-23T08:00:00.000Z',
            writtenQuestionCount: 4,
            mode: 'answers-with-columns',
          },
        })}
      />,
    );
    expect(screen.getByText(/上次匯出：.*（4 題，答案＋組別時間欄）/)).toBeTruthy();
  });

  it('三種模式都有說明，預設選取「只有答案」，非已結束時停用（002 FR-017）', () => {
    const { unmount } = render(<ExportPanel view={teacherView({ status: 'CLOSED' })} />);
    const radios = screen.getAllByRole<HTMLInputElement>('radio');
    expect(radios).toHaveLength(3);
    expect(screen.getByRole<HTMLInputElement>('radio', { name: /只有答案/ }).checked).toBe(true);
    expect(screen.getByText(/新增「搶答組別」「提交時間」「搶答送出者」三欄/)).toBeTruthy();
    expect(screen.getByText(/複製答案格時會一併複製這一行/)).toBeTruthy();
    unmount();
    render(<ExportPanel view={teacherView({ status: 'OPEN' })} />);
    expect(screen.getAllByRole('radio').every((r) => r.matches(':disabled'))).toBe(true);
  });

  it('選擇其他模式後送出該模式，完成訊息顯示模式名稱', async () => {
    const { calls } = mockFetch([
      {
        status: 200,
        body: {
          mode: 'answers-with-note-line',
          writtenQuestionCount: 1,
          writtenCellCount: 1,
          exportedAt: '2026-11-23T08:00:00.000Z',
        },
      },
    ]);
    render(<ExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(screen.getByRole('radio', { name: /答案＋格內附註行/ }));
    await userEvent.click(button());
    expect(await screen.findByText(/已寫入 1 題、1 格（答案＋格內附註行/)).toBeTruthy();
    expect(bodyOf(calls[0]?.init)).toEqual({ mode: 'answers-with-note-line' });
  });

  it('預設送出「只有答案」', async () => {
    const { calls } = mockFetch([
      {
        status: 200,
        body: {
          mode: 'answers-only',
          writtenQuestionCount: 1,
          writtenCellCount: 1,
          exportedAt: '2026-11-23T08:00:00.000Z',
        },
      },
    ]);
    render(<ExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(button());
    await screen.findByText(/已寫入 1 題/);
    expect(bodyOf(calls[0]?.init)).toEqual({ mode: 'answers-only' });
  });
});
