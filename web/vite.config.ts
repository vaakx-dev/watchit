import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const server = process.env.WATCHIT_SERVER ?? 'http://127.0.0.1:7171';

export default defineConfig({
  plugins: [react()],
  server: { host: '0.0.0.0', proxy: { '/api': { target: server, changeOrigin: false, ws: true } } },
  preview: { host: '0.0.0.0', proxy: { '/api': { target: server, changeOrigin: false, ws: true } } },
  test: { include: ['src/**/*.test.ts'] },
});
