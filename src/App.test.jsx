import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import App from './App'

// ── Mock Supabase ──────────────────────────────────────────
vi.mock('./supabaseClient', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
      insert: () => Promise.resolve({ error: null }),
    }),
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: (_event, _cb) => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  },
}))

// ── Mock fetchListings + constants ─────────────────────────
vi.mock('./data/listings', () => ({
  fetchListings: () =>
    Promise.resolve([
      {
        id: '1',
        title: 'Sony PS5',
        price: 'R 10 999',
        pricePrefix: '',
        condition: 'Good',
        category: 'Electronics',
        seller: 'Saurav',
        distance: '0 km',
        image_url: '',
        emoji: '🎮',
        rating: 4,
        reviewCount: 2,
        user_id: 'user-abc',
        description: 'Great console.',
        approximate_location: 'Johannesburg',
        joined_year: 2024,
      },
      {
        id: '2',
        title: 'Master Shifu Children Toy',
        price: 'R 150',
        pricePrefix: '',
        condition: 'Like New',
        category: 'Other',
        seller: 'Nayan',
        distance: '0 km',
        image_url: '',
        emoji: '🧸',
        rating: 0,
        reviewCount: 0,
        user_id: 'user-xyz',
        description: 'Barely used.',
        approximate_location: 'Pretoria',
        joined_year: 2023,
      },
    ]),
  CATEGORIES: [
    { label: 'All Items', emoji: '🛍️' },
    { label: 'Textbooks', emoji: '📚' },
    { label: 'Electronics', emoji: '💻' },
    { label: 'Furniture', emoji: '🪑' },
    { label: 'Clothing', emoji: '👕' },
    { label: 'Sports', emoji: '⚽' },
    { label: 'Instruments', emoji: '🎸' },
    { label: 'Stationery', emoji: '✏️' },
    { label: 'Other', emoji: '📦' },
  ],
  CONDITIONS: ['All Conditions', 'Like New', 'Good', 'Fair', 'Poor'],
  CONDITION_COLORS: {
    'Like New': '#22c55e',
    Good: '#f59e0b',
    Fair: '#ef4444',
    Poor: '#6b7280',
  },
}))

// ── Navbar ─────────────────────────────────────────────────

test('renders the search bar with correct placeholder', async () => {
  render(<App />)
  const input = await screen.findByPlaceholderText(
    'Search textbooks, electronics, furniture...'
  )
  expect(input).toBeInTheDocument()
})

test('renders Log In and Sign Up Free buttons when logged out', async () => {
  render(<App />)
  expect(await screen.findByRole('button', { name: /log in/i })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: /sign up free/i })).toBeInTheDocument()
})

test('does not render List Item or Messages when logged out', async () => {
  render(<App />)
  await screen.findByRole('button', { name: /log in/i })
  expect(screen.queryByRole('button', { name: /list item/i })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /messages/i })).not.toBeInTheDocument()
})

// ── FilterBar ──────────────────────────────────────────────

test('renders category select with All Items as default', async () => {
  render(<App />)
  const categorySelect = await screen.findByLabelText(/category/i)
  expect(categorySelect).toBeInTheDocument()
  expect(categorySelect.value).toBe('All Items')
})

test('renders condition select with All Conditions as default', async () => {
  render(<App />)
  const conditionSelect = await screen.findByLabelText(/condition/i)
  expect(conditionSelect.value).toBe('All Conditions')
})

test('renders price select with Any price as default', async () => {
  render(<App />)
  const priceSelect = await screen.findByLabelText(/price/i)
  expect(priceSelect.value).toBe('')
})

test('shows custom price range inputs when Custom range is selected', async () => {
  render(<App />)
  const priceSelect = await screen.findByLabelText(/price/i)
  fireEvent.change(priceSelect, { target: { value: 'custom' } })
  expect(await screen.findByLabelText(/minimum price/i)).toBeInTheDocument()
  expect(await screen.findByLabelText(/maximum price/i)).toBeInTheDocument()
})

test('shows Clear filters button when a filter is active', async () => {
  render(<App />)
  const categorySelect = await screen.findByLabelText(/category/i)
  fireEvent.change(categorySelect, { target: { value: 'Electronics' } })
  expect(await screen.findByRole('button', { name: /clear filters/i })).toBeInTheDocument()
})

// ── Listing Cards ──────────────────────────────────────────

test('renders listing cards from fetched data', async () => {
  render(<App />)
  const ps5Matches = await screen.findAllByText('Sony PS5')
  expect(ps5Matches.length).toBeGreaterThan(0)
  expect(await screen.findByText('Master Shifu Children Toy')).toBeInTheDocument()
})

test('renders price on listing card', async () => {
  render(<App />)
  expect(await screen.findByText('R 10 999')).toBeInTheDocument()
})

test('renders condition badge on listing card', async () => {
  render(<App />)
  const badges = await screen.findAllByText('Good')
  expect(badges.length).toBeGreaterThan(0)
})

test('renders seller name on listing card', async () => {
  render(<App />)
  expect(await screen.findByText(/Saurav/)).toBeInTheDocument()
})

// ── Modal ──────────────────────────────────────────────────

test('opens listing details modal when a card is clicked', async () => {
  render(<App />)
  const cardTitles = await screen.findAllByText('Sony PS5')
  fireEvent.click(cardTitles[0])

  await waitFor(() => {
    expect(screen.getByRole('heading', { name: /description/i })).toBeInTheDocument()
  })
})

test('modal shows login prompt when user is not logged in', async () => {
  render(<App />)
  const cardTitles = await screen.findAllByText('Sony PS5')
  fireEvent.click(cardTitles[0])

  expect(await screen.findByText(/please.*log in/i)).toBeInTheDocument()
})

test('modal shows seller info', async () => {
  render(<App />)
  const cardTitles = await screen.findAllByText('Sony PS5')
  fireEvent.click(cardTitles[0])

  expect(await screen.findByText(/Saurav/)).toBeInTheDocument()
  expect(await screen.findByText(/Johannesburg/i)).toBeInTheDocument()
})

test('closes modal when close button is clicked', async () => {
  render(<App />)
  const cardTitles = await screen.findAllByText('Sony PS5')
  fireEvent.click(cardTitles[0])

  const closeBtn = await screen.findByRole('button', { name: /close item details/i })
  fireEvent.click(closeBtn)

  await waitFor(() => {
    expect(screen.queryByRole('heading', { name: /description/i })).not.toBeInTheDocument()
  })
})

// ── Search ─────────────────────────────────────────────────

test('filters listings by search query', async () => {
  render(<App />)
  const input = await screen.findByPlaceholderText(
    'Search textbooks, electronics, furniture...'
  )

  fireEvent.change(input, { target: { value: 'PS5' } })

  const ps5Matches = await screen.findAllByText('Sony PS5')
  expect(ps5Matches.length).toBeGreaterThan(0)

  await waitFor(() => {
    expect(screen.queryByText('Master Shifu Children Toy')).not.toBeInTheDocument()
  })
})

test('filters listings by category select', async () => {
  render(<App />)
  const categorySelect = await screen.findByLabelText(/category/i)

  fireEvent.change(categorySelect, { target: { value: 'Electronics' } })

  const ps5Matches = await screen.findAllByText('Sony PS5')
  expect(ps5Matches.length).toBeGreaterThan(0)

  await waitFor(() => {
    expect(screen.queryByText('Master Shifu Children Toy')).not.toBeInTheDocument()
  })
})