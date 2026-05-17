import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const rawBasePath = env.VITE_BASE_PATH?.trim();
  const base =
    rawBasePath && rawBasePath !== ''
      ? rawBasePath.replace(/^([^/])/, '/$1').replace(/([^/])$/, '$1/')
      : '/';

  return {
    base,
    plugins: [react()],
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: './src/setupTests.js',
      pool: 'threads',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        reportsDirectory: './coverage',
        exclude: [
          'src/setupTests.js',
          'src/test/**',
          // High-level orchestration shells are covered through focused page/helper tests.
          'src/App.jsx',
          'src/components/TradeFacilityDashboard.jsx',
        ],
      },
    },
  };
})
