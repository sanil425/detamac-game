import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Served from https://<username>.github.io/detamac-game/
export default defineConfig({
  base: '/detamac-game/',
  plugins: [react()],
  test: {
    // Unit tests only; the Playwright e2e tests in e2e/ run with `npm run test:e2e`.
    include: ['src/**/*.test.ts'],
  },
});
