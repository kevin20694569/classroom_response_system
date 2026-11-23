import { defaultClientConditions, defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// 開發時由 Vite 提供前端，/api 與 /socket.io 轉給後端（預設 3000 埠）
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // 直接使用 @crs/shared 的 TypeScript 原始碼（共用契約的唯一來源）
    conditions: ['development', ...defaultClientConditions],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': { target: 'http://localhost:3000', ws: true },
    },
  },
});
