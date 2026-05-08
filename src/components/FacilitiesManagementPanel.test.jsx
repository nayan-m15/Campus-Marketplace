// Test file for Facilities Management Panel
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FacilitiesManagementPanel from './FacilitiesManagementPanel';

// Mock Supabase
vi.mock('../supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        order: vi.fn(() => Promise.resolve({ data: [], error: null }))
      }))
    })),
  },
}));

// Mock bookingScheduling utils
vi.mock('../utils/bookingScheduling', () => ({
  DAYS: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  normalizeFacilityDay: vi.fn((day) => day),
}));

describe('FacilitiesManagementPanel', () => {
  it('renders the facilities management panel', async () => {
    render(<FacilitiesManagementPanel />);
    
    expect(screen.getByText('Facilities Management')).toBeInTheDocument();
    expect(screen.getByText('Manage campus facilities, operating hours, and capacity settings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add facility/i })).toBeInTheDocument();
    expect(await screen.findByText('No facilities found')).toBeInTheDocument();
  });

  it('shows search and filter controls', () => {
    render(<FacilitiesManagementPanel />);
    
    expect(screen.getByPlaceholderText('Search facilities...')).toBeInTheDocument();
    expect(screen.getByText('All Status')).toBeInTheDocument();
  });

  it('displays empty state when no facilities', async () => {
    render(<FacilitiesManagementPanel />);
    
    expect(await screen.findByText('No facilities found')).toBeInTheDocument();
    expect(screen.getByText('Get started by adding your first facility.')).toBeInTheDocument();
  });
});
