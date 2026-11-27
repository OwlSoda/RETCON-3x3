import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_');
  const rawAllowedHosts = env.VITE_ALLOWED_HOSTS?.trim();
  const allowedHosts =
    rawAllowedHosts === 'true'
      ? true
      : rawAllowedHosts
        ? rawAllowedHosts
            .split(',')
            .map((host) => host.trim())
            .filter(Boolean)
        : undefined;

  return {
    plugins: [react()],
    server: {
      port: 3000,
      host: true,
      ...(allowedHosts !== undefined ? { allowedHosts } : {}),
    },
  };
});
