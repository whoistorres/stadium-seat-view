import { defineConfig } from 'vite';
import { stadiumDataPlugin } from './plugins/stadiumDataPlugin.ts';

export default defineConfig({
  plugins: [stadiumDataPlugin()],
  server: { port: 5173 },
  build: { target: 'es2022', chunkSizeWarningLimit: 900 },
});
