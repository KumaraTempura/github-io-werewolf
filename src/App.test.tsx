import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'

describe('App shell', () => {
  it('renders the zh-Hant title', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', { name: '狼人殺法官筆記' }),
    ).toBeInTheDocument()
  })
})
