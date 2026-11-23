import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExportPanel } from '../src/pages/teacher/ExportPanel';
import { mockFetch } from './helpers';
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
          lastExport: { exportedAt: '2026-11-23T08:00:00.000Z', writtenQuestionCount: 4 },
        })}
      />,
    );
    expect(screen.getByText(/上次匯出：.*（4 題）/)).toBeTruthy();
  });
});
