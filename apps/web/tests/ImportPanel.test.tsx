import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { QuestionList } from '../src/components/QuestionList';
import {
  CLOSED_CONFIRM_MESSAGE,
  ImportPanel,
  READY_REIMPORT_NOTICE,
} from '../src/pages/teacher/ImportPanel';
import { bodyOf, mockFetch } from './helpers';
import { teacherView } from './viewBuilders';

const URL_TEXT = 'https://docs.google.com/spreadsheets/d/group-doc/edit';

async function submit(urlText = URL_TEXT) {
  await userEvent.type(screen.getByLabelText('Google Sheets 網址'), urlText);
  await userEvent.click(screen.getByRole('button', { name: /匯入/ }));
}

describe('ImportPanel（US1）', () => {
  it('匯入成功後顯示題數與工作表名稱，並送出網址與組數', async () => {
    const { calls } = mockFetch([{ status: 200, body: { view: teacherView() } }]);
    render(<ImportPanel view={teacherView({ status: 'NOT_IMPORTED' })} />);
    await submit();
    expect(await screen.findByText('已匯入 4 題（工作表「學習單」）。')).toBeTruthy();
    expect(calls[0]?.url).toBe('/api/session/import');
    expect(bodyOf(calls[0]?.init)).toEqual({ spreadsheetUrl: URL_TEXT, groupCount: 2 });
  });

  it('格式錯誤時列出每個問題的位置', async () => {
    mockFetch([
      {
        status: 422,
        body: {
          error: {
            code: 'GUIDED_NOTES_INVALID',
            message: 'Guided Notes 格式不符，請依下列位置修正後再匯入。',
            details: [
              {
                code: 'INVALID_QUESTION_NUMBER',
                message: '題號「A-1」無法辨識。',
                sheetTitle: '學習單',
                row: 9,
                column: 'B',
              },
            ],
          },
        },
      },
    ]);
    render(<ImportPanel view={teacherView({ status: 'NOT_IMPORTED' })} />);
    await submit();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('格式不符');
    expect(alert.textContent).toContain('工作表「學習單」、第 9 列、B 欄');
    expect(alert.textContent).toContain('題號「A-1」無法辨識。');
  });

  it('已結束時先確認，確認後送出 confirmDiscard', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { calls } = mockFetch([{ status: 200, body: { view: teacherView() } }]);
    render(<ImportPanel view={teacherView({ status: 'CLOSED' })} />);
    await submit();
    expect(confirm).toHaveBeenCalledWith(CLOSED_CONFIRM_MESSAGE);
    expect(bodyOf(calls[0]?.init)).toMatchObject({ confirmDiscard: true });
  });

  it('已結束時取消確認就不送出', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { fetchMock } = mockFetch([]);
    render(<ImportPanel view={teacherView({ status: 'CLOSED' })} />);
    await submit();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('待開始時顯示「已加入的學生需重新選擇組別加入」提示', () => {
    render(<ImportPanel view={teacherView({ status: 'READY' })} />);
    expect(screen.getByText(READY_REIMPORT_NOTICE)).toBeTruthy();
  });

  it('搶答進行中時停用表單並說明原因', () => {
    render(<ImportPanel view={teacherView({ status: 'OPEN' })} />);
    expect(screen.getByLabelText<HTMLInputElement>('Google Sheets 網址').disabled).toBe(true);
    expect(screen.getByText('搶答進行中不能匯入，請先結束搶答。')).toBeTruthy();
  });
});

describe('QuestionList', () => {
  it('列出題號並標示題組與子題數', () => {
    render(<QuestionList view={teacherView()} />);
    expect(screen.getByText(/共 4 題、2/)).toBeTruthy();
    expect(screen.getAllByText(/題組（2 子題）/)).toHaveLength(2);
    expect(screen.getByText('第 3 題')).toBeTruthy();
  });
});
