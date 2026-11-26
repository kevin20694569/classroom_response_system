import { CSV_EXPORT_NOT_CLOSED_MESSAGE, CSV_EXPORT_PATH } from '@crs/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CsvExportPanel } from '../src/pages/teacher/CsvExportPanel';
import { teacherView } from './viewBuilders';

const FILE_NAME = '搶答結果_20261126-1032.csv';
const button = () => screen.getByRole<HTMLButtonElement>('button', { name: /匯出/ });

let createObjectURL: ReturnType<typeof vi.fn<(blob: Blob) => string>>;
let revokeObjectURL: ReturnType<typeof vi.fn<(url: string) => void>>;
let anchorClick: ReturnType<typeof vi.fn>;
let downloadedNames: string[];

beforeEach(() => {
  downloadedNames = [];
  revokeObjectURL = vi.fn<(url: string) => void>();
  createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:fake');
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = revokeObjectURL;
  anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    downloadedNames.push(this.download);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function stubCsvResponse() {
  const fetchMock = vi.fn(() =>
    Promise.resolve(
      new Response('﻿題號,子題\r\n', {
        status: 200,
        headers: {
          'Content-Disposition': `attachment; filename="results_20261126-1032.csv"; filename*=UTF-8''${encodeURIComponent(FILE_NAME)}`,
        },
      }),
    ),
  );
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('CsvExportPanel（成功路徑）', () => {
  it('按下「匯出 CSV」會帶 token 下載並以回應的檔名存檔', async () => {
    sessionStorage.setItem('crs.token', 'teacher-token');
    const fetchMock = stubCsvResponse();
    render(<CsvExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(button());

    expect(await screen.findByText(`已下載 ${FILE_NAME}。`)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(CSV_EXPORT_PATH);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer teacher-token');
    expect(downloadedNames).toEqual([FILE_NAME]);
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:fake');
  });

  it('下載中按鈕顯示「匯出中…」並停用', async () => {
    let release: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      ),
    );
    render(<CsvExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(button());
    expect(screen.getByRole<HTMLButtonElement>('button', { name: '匯出中…' }).disabled).toBe(true);
    release(new Response('x', { status: 200 }));
    expect(await screen.findByText('已下載 搶答結果.csv。')).toBeTruthy();
  });
});

describe('CsvExportPanel（US4：停用與錯誤）', () => {
  it.each(['NOT_IMPORTED', 'READY', 'OPEN'] as const)('%s 時按鈕停用並顯示提示', (status) => {
    render(<CsvExportPanel view={teacherView({ status })} />);
    expect(button().disabled).toBe(true);
    expect(screen.getByText(CSV_EXPORT_NOT_CLOSED_MESSAGE)).toBeTruthy();
  });

  it('view 改成 CLOSED 後按鈕可按、提示消失', () => {
    const { rerender } = render(<CsvExportPanel view={teacherView({ status: 'OPEN' })} />);
    expect(button().disabled).toBe(true);
    rerender(<CsvExportPanel view={teacherView({ status: 'CLOSED' })} />);
    expect(button().disabled).toBe(false);
    expect(screen.queryByText(CSV_EXPORT_NOT_CLOSED_MESSAGE)).toBeNull();
  });

  it('伺服器回 409 時顯示伺服器訊息，且不下載；錯誤後可以再按一次', async () => {
    const errorResponse = () =>
      new Response(
        JSON.stringify({
          error: { code: 'INVALID_TRANSITION', message: CSV_EXPORT_NOT_CLOSED_MESSAGE },
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } },
      );
    const fetchMock = vi.fn(() => Promise.resolve(errorResponse()));
    vi.stubGlobal('fetch', fetchMock);
    render(<CsvExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(button());
    expect(await screen.findByText(CSV_EXPORT_NOT_CLOSED_MESSAGE)).toBeTruthy();
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(anchorClick).not.toHaveBeenCalled();
    expect(button().disabled).toBe(false);
    await userEvent.click(button());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('網路錯誤時顯示連線訊息且不下載', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('failed'))),
    );
    render(<CsvExportPanel view={teacherView({ status: 'CLOSED' })} />);
    await userEvent.click(button());
    expect(await screen.findByText('無法連線到伺服器，請確認系統已啟動。')).toBeTruthy();
    expect(anchorClick).not.toHaveBeenCalled();
  });
});
