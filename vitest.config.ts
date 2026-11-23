import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// 三個測試專案：共用契約、後端、前端（jsdom）。測試一律不連線 Google 或讀取真實金鑰。
export default defineConfig({
  resolve: {
    conditions: ['development'],
  },
  ssr: {
    resolve: {
      conditions: ['development'],
      externalConditions: ['development'],
    },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'shared',
          include: ['packages/shared/tests/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          include: ['apps/server/tests/**/*.test.ts'],
          environment: 'node',
          testTimeout: 30_000,
        },
      },
      {
        extends: true,
        plugins: [react()],
        test: {
          name: 'web',
          include: ['apps/web/tests/**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['apps/web/tests/setup.ts'],
        },
      },
    ],
  },
});
