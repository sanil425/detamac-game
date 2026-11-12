import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Served from https://<username>.github.io/detamac-game/
export default defineConfig({
  base: '/detamac-game/',
  plugins: [react()],
});
