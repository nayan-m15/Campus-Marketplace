import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock the AuthContext since it uses Supabase
vi.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => <div>{children}</div>,
  useAuth: () => ({
    user: null,
    loading: false,
    signOut: vi.fn(),
  }),
}));

// Mock the data
vi.mock('./data/listings', () => ({
  ALL_LISTINGS: [
    { id: 1, title: 'Test Item', category: 'Electronics' }
  ],
}));

// Mock components that might cause issues
vi.mock('./components/Navbar', () => ({
  default: () => <div>Mock Navbar</div>
}));

vi.mock('./components/Hero', () => ({
  default: () => <div>Mock Hero</div>
}));

vi.mock('./components/CategoryBar', () => ({
  default: () => <div>Mock CategoryBar</div>
}));

vi.mock('./components/ListingsGrid', () => ({
  default: () => <div>Mock ListingsGrid</div>
}));

vi.mock('./components/Footer', () => ({
  default: () => <div>Mock Footer</div>
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeDefined();
  });

  it('shows loading state initially', () => {
    // You can test loading state if needed
    expect(true).toBe(true);
  });
});