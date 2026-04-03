import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders the search bar', () => {
    render(<App />)
    expect(
      screen.getByPlaceholderText(/search textbooks, electronics, furniture/i)
    ).toBeInTheDocument()
  })
})