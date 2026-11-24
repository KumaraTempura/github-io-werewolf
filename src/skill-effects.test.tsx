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

beforeEach(() => {
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

it('marks the target of a gun shot out', () => {
  startGame()

  const hunter = openSeat(6)
  fireEvent.change(within(hunter).getByLabelText('6 號 · 帶走目標'), {
    target: { value: '1' },
  })
  fireEvent.click(within(hunter).getByRole('button', { name: '關閉' }))

  expect(
    within(screen.getByRole('button', { name: '座位 1 詳情' })).getByText(
      '出局 · 開槍',
    ),
  ).toBeInTheDocument()
})

it('records the check target on the peek', () => {
  startGame()

  const seer = openSeat(4)
  fireEvent.click(within(seer).getByRole('button', { name: '座位 4 查驗' }))

  const pickTarget = screen.getByRole('dialog', { name: '選擇查驗目標' })
  fireEvent.click(
    within(pickTarget).getByRole('button', { name: '查驗座位 1' }),
  )
  fireEvent.click(within(pickTarget).getByRole('button', { name: '下一步' }))
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '查驗預覽' })).getByRole(
      'button',
      { name: '出示給玩家' },
    ),
  )
  fireEvent.click(
    within(screen.getByRole('dialog', { name: '查驗結果' })).getByRole(
      'button',
      { name: '完成' },
    ),
  )

  const reopened = screen.getByRole('dialog', { name: '座位 4 狀態' })
  expect(
    within(reopened).getByRole('button', {
      name: '4 號 · 已查驗座位 1 號',
    }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(within(reopened).getByLabelText('4 號 · 最近查驗目標')).toHaveValue('1')
  expect(within(reopened).getByLabelText('4 號 · 最近查驗陣營')).toHaveValue('wolf')
})
