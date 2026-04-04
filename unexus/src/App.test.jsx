import { vi } from 'vitest';

vi.mock('./config', () => ({
  SUPABASE_URL: 'https://test-url.com',
  SUPABASE_ANON_KEY: 'test-key',
}));