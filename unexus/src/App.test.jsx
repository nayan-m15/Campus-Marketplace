import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./config', () => ({
  SUPABASE_URL: 'https://test-url.com',
  SUPABASE_ANON_KEY: 'test-key',
}));

test('renders app', () => {
  render(<App />);
  expect(screen.getByText(/vite/i)).toBeInTheDocument();
});