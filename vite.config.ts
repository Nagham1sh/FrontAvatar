import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 5173 is used by another local project on this machine.
  server: { port: 5180, strictPort: true },
});
