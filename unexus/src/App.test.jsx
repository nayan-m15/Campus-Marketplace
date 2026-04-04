import { render, screen } from '@testing-library/react'
import App from './App'

test('renders the search bar', async () => {
  render(<App />)

  const searchInput = await screen.findByPlaceholderText(
    /search textbooks, electronics, furniture/i
  )

  expect(searchInput).toBeInTheDocument()
})