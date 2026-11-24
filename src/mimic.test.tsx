import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import App from './App'

function startCustomMimicGame() {
  render(<App />)
  fireEvent.change(screen.getByLabelText('板子'), {
    target: { value: 'custom' },
  })
  fireEvent.click(screen.getByRole('button', { name: '減少人數' }))
  fireEvent.click(screen.getByRole('button', { name: '減少人數' }))
  const assignments: readonly [number, string][] = [
    [1, 'awakened-hidden-wolf'],
    [2, 'dream-weaver'],
    [3, 'seer'],
    [4, 'villager'],
    [5, 'villager'],
    [6, 'villager'],
    [7, 'villager'],
  ]
  for (const [seat, roleId] of assignments) {
    fireEvent.change(screen.getByLabelText(`座位 ${seat} 角色`), {
      target: { value: roleId },
    })
  }
  fireEvent.click(screen.getByRole('button', { name: '實體發牌' }))
  fireEvent.click(screen.getByRole('button', { name: '開始遊戲（實體）' }))
}

function openSeat(seat: number) {
  fireEvent.click(screen.getByRole('button', { name: `座位 ${seat} 詳情` }))
  return screen.getByRole('dialog', { name: `座位 ${seat} 狀態` })
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

it('gives the awakened hidden wolf the copied dream weaver options', () => {
  startCustomMimicGame()

  const sheet = openSeat(1)
  const mimickedRole = within(sheet).getByLabelText('1 號 · 模仿到的角色')
  fireEvent.change(mimickedRole, { target: { value: 'dream-weaver' } })

  expect(mimickedRole).toHaveValue('dream-weaver')

  const dreamTarget = within(sheet).getByLabelText('1 號 · 本夜夢遊者')
  fireEvent.change(dreamTarget, { target: { value: '3' } })

  expect(dreamTarget).toHaveValue('3')
})
