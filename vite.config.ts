import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { normalizePath } from 'vite';
import { close_services, handle_api } from './server/api.ts';
import { data_directory } from './server/storage/paths.ts';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'catalog-api',
      configureServer(server) {
        server.middlewares.use(handle_api);
        server.httpServer?.once('close', close_services);
      },
      configurePreviewServer(server) {
        server.middlewares.use(handle_api);
        server.httpServer.once('close', close_services);
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    watch: { ignored: ['**/data/**', `${normalizePath(data_directory())}/**`] },
    fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/data/**', `${normalizePath(data_directory())}/**`] },
  },
  preview: { host: '0.0.0.0' },
  test: { include: ['src/**/*.test.ts', 'server/**/*.test.ts'] },
});
