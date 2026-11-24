import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, expect, it } from 'vitest'
import App from './App'

function startGame() {
  render(<App />)
  fireEvent.click(screen.getByRole('button', { name: '實體發牌' }))
  fireEvent.click(screen.getByRole('button', { name: '開始遊戲（實體）' }))
}

function openSeat(seat: number) {
  fireEvent.click(screen.getByRole('button', { name: `座位 ${seat} 詳情` }))
  return screen.getByRole('dialog', { name: `座位 ${seat} 狀態` })
}

function setSaveTarget(targetSeat: number) {
  const witch = openSeat(5)
  fireEvent.change(within(witch).getByLabelText('5 號 · 本夜解藥目標'), {
    target: { value: String(targetSeat) },
  })
  fireEvent.click(within(witch).getByRole('button', { name: '關閉' }))
}

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

it('revives a night-killed player when the witch saves them', () => {
  startGame()

  const victim = openSeat(1)
  fireEvent.click(
    within(victim).getByRole('button', { name: '座位 1 出局 夜間擊殺' }),
  )
  fireEvent.click(within(victim).getByRole('button', { name: '關閉' }))
  expect(
    within(screen.getByRole('button', { name: '座位 1 詳情' })).getByText(
      /出局/,
    ),
  ).toBeInTheDocument()

  setSaveTarget(1)

  expect(
    within(screen.getByRole('button', { name: '座位 1 詳情' })).queryByText(
      /出局/,
    ),
  ).not.toBeInTheDocument()

  fireEvent.click(screen.getByRole('button', { name: '事件記錄' }))
  const log = screen.getByRole('dialog', { name: '事件記錄' })
  expect(within(log).getByText('1 號 狼人 · 復活')).toBeInTheDocument()
})

it('revives after a save recorded before the kill', () => {
  startGame()

  setSaveTarget(1)

  const victim = openSeat(1)
  fireEvent.click(
    within(victim).getByRole('button', { name: '座位 1 出局 夜間擊殺' }),
  )
  expect(within(victim).getByText('已出局')).toBeInTheDocument()

  fireEvent.click(within(victim).getByRole('button', { name: '座位 1 復活' }))
  fireEvent.click(within(victim).getByRole('button', { name: '關閉' }))

  expect(
    within(screen.getByRole('button', { name: '座位 1 詳情' })).queryByText(
      /出局/,
    ),
  ).not.toBeInTheDocument()
})

it('does not revive a player who was not night-killed', () => {
  startGame()

  const victim = openSeat(1)
  fireEvent.click(
    within(victim).getByRole('button', { name: '座位 1 出局 放逐' }),
  )
  expect(
    within(victim).queryByRole('button', { name: '座位 1 復活' }),
  ).not.toBeInTheDocument()
  fireEvent.click(within(victim).getByRole('button', { name: '關閉' }))

  setSaveTarget(1)

  expect(
    within(screen.getByRole('button', { name: '座位 1 詳情' })).getByText(
      /出局 · 放逐/,
    ),
  ).toBeInTheDocument()
})
