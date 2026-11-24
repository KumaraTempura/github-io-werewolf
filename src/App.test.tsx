import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { NOTEBOOK_STORAGE_KEY } from './game/storage'

const standardAssignments = [
  'wolf',
  'wolf',
  'wolf',
  'seer',
  'witch',
  'hunter',
  'villager',
  'villager',
  'villager',
]

function setup() {
  return render(<App />)
}

function seatCard(seat: number): HTMLElement {
  return screen.getByRole('article', { name: `座位 ${seat}` })
}

function aliveCount(container: HTMLElement): string {
  return (
    container
      .querySelector('.game-head__alive')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim() ?? ''
  )
}

function chooseCustomBoard(playerCount: number) {
  fireEvent.change(screen.getByLabelText('板子'), {
    target: { value: 'custom' },
  })
  const currentCount = screen.getAllByLabelText(/^座位 \d+ 角色$/).length
  for (let count = currentCount; count > playerCount; count -= 1) {
    fireEvent.click(screen.getByRole('button', { name: '減少人數' }))
  }
}

function startPhysicalGame() {
  const view = setup()
  fireEvent.click(screen.getByRole('button', { name: '實體發牌' }))
  fireEvent.click(screen.getByRole('button', { name: '開始遊戲（實體）' }))
  return view
}

afterEach(() => {
  cleanup()
})

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts on the standard 333 setup', () => {
    setup()

    expect(
      screen.getByRole('heading', { name: '把這一局記下來' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('板子')).toHaveValue('standard-333')
    expect(screen.getByRole('button', { name: '發牌（數位）' })).toBeEnabled()
  })

  it('opens the in-play screen with a card per seat after a physical start', () => {
    const { container } = startPhysicalGame()

    expect(screen.getByRole('heading', { name: '標準 333' })).toBeInTheDocument()
    expect(aliveCount(container)).toBe('9 / 9 在場')
    expect(container.querySelectorAll('.game-seat')).toHaveLength(9)

    const first = seatCard(1)
    expect(within(first).getByText('狼人')).toBeInTheDocument()
    expect(within(first).getByText('狼人陣營')).toBeInTheDocument()

    const seer = seatCard(4)
    expect(within(seer).getByText('預言家')).toBeInTheDocument()
    expect(within(seer).getByText('好人陣營/神職')).toBeInTheDocument()
  })

  it('deals every seat with judge-held reveals and starts the game', () => {
    const { container } = setup()

    fireEvent.click(screen.getByRole('button', { name: '發牌（數位）' }))

    expect(
      screen.getByRole('heading', { name: '逐座出示角色' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '開始遊戲' })).toBeDisabled()

    const dealtRoles = Array.from(
      container.querySelectorAll('.deal-row__role'),
    ).map((element) => element.textContent)

    for (let seat = 1; seat <= 9; seat += 1) {
      fireEvent.click(screen.getByRole('button', { name: `座位 ${seat}` }))
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByRole('heading')).toBeInTheDocument()
      fireEvent.click(within(dialog).getByRole('button', { name: '完成' }))
    }

    const start = screen.getByRole('button', { name: '開始遊戲' })
    expect(start).toBeEnabled()
    fireEvent.click(start)

    expect(screen.getByRole('heading', { name: '標準 333' })).toBeInTheDocument()
    expect(aliveCount(container)).toBe('9 / 9 在場')
    expect(container.querySelectorAll('.game-seat')).toHaveLength(9)

    for (let seat = 1; seat <= 9; seat += 1) {
      expect(
        within(seatCard(seat)).getByText(dealtRoles[seat - 1] ?? ''),
      ).toBeInTheDocument()
    }
  })

  it('locks swapping and reshuffling after the first reveal', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '發牌（數位）' }))

    expect(screen.getByRole('button', { name: '重新洗牌' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '交換座位 2' })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: '座位 1' }))
    fireEvent.click(screen.getByRole('button', { name: '完成' }))

    expect(screen.getByRole('button', { name: '重新洗牌' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '交換座位 2' })).toBeDisabled()
  })

  it('swaps two seats before the first reveal', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '發牌（數位）' }))

    const roleAt = (seat: number) =>
      screen
        .getByRole('button', { name: `座位 ${seat}` })
        .querySelector('.deal-row__role')?.textContent
    const first = roleAt(1)
    const second = roleAt(2)

    fireEvent.click(screen.getByRole('button', { name: '交換座位 1' }))
    fireEvent.click(screen.getByRole('button', { name: '交換座位 2' }))

    expect(roleAt(1)).toBe(second)
    expect(roleAt(2)).toBe(first)
  })

  it('builds a custom board with a clamped player count and required roles', () => {
    setup()
    chooseCustomBoard(8)

    expect(screen.getAllByLabelText(/^座位 \d+ 角色$/)).toHaveLength(8)

    const primary = screen.getByRole('button', { name: '發牌（數位）' })
    expect(primary).toBeEnabled()

    fireEvent.change(screen.getByLabelText('座位 1 角色'), {
      target: { value: '' },
    })
    expect(primary).toBeDisabled()

    fireEvent.change(screen.getByLabelText('座位 1 角色'), {
      target: { value: 'seer' },
    })
    expect(primary).toBeEnabled()
  })

  it('offers the hidden wolf immediately after the awakened hidden wolf', () => {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '實體發牌' }))

    const options = within(screen.getByLabelText('座位 1 角色'))
      .getAllByRole('option')
      .map((option) => option.textContent?.trim())
    const hiddenIndex = options.indexOf('隱狼')

    expect(hiddenIndex).toBeGreaterThan(-1)
    expect(options[hiddenIndex - 1]).toBe('覺醒隱狼')
  })

  it('clamps custom boards to 7 through 12 seats', () => {
    setup()
    fireEvent.change(screen.getByLabelText('板子'), {
      target: { value: 'custom' },
    })

    for (let step = 0; step < 5; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: '減少人數' }))
    }
    expect(screen.getAllByLabelText(/^座位 \d+ 角色$/)).toHaveLength(7)

    fireEvent.click(screen.getByRole('button', { name: '減少人數' }))
    expect(screen.getAllByLabelText(/^座位 \d+ 角色$/)).toHaveLength(7)

    for (let step = 0; step < 10; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: '增加人數' }))
    }
    expect(screen.getAllByLabelText(/^座位 \d+ 角色$/)).toHaveLength(12)

    fireEvent.click(screen.getByRole('button', { name: '增加人數' }))
    expect(screen.getAllByLabelText(/^座位 \d+ 角色$/)).toHaveLength(12)
  })

  it('reveals only the hidden wolf role and camp during the deal', () => {
    setup()
    chooseCustomBoard(7)
    fireEvent.change(screen.getByLabelText('座位 1 角色'), {
      target: { value: 'hidden-wolf' },
    })
    fireEvent.click(screen.getByRole('button', { name: '發牌（數位）' }))

    const seat = screen
      .getAllByRole('button', { name: /^座位 \d+$/ })
      .find((button) => within(button).queryByText('隱狼'))
    if (!seat) {
      throw new Error('hidden wolf seat not found')
    }
    const seatNumber = seat.getAttribute('aria-label')?.replace('座位 ', '')
    fireEvent.click(seat)

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `數位發牌 · 只給 ${seatNumber} 號看狼人陣營隱狼完成取消出示`,
    )
  })

  it('resets to the default standard 333 setup only after confirmation', async () => {
    startPhysicalGame()

    fireEvent.click(screen.getByRole('button', { name: '重設這一局' }))
    const dialog = screen.getByRole('alertdialog', { name: '重設這一局' })
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.getByRole('heading', { name: '標準 333' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '重設這一局' }))
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: '重設這一局' })).getByRole(
        'button',
        { name: '重設遊戲' },
      ),
    )

    expect(
      await screen.findByRole('heading', { name: '把這一局記下來' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('板子')).toHaveValue('standard-333')
    expect(screen.getByRole('button', { name: '發牌（數位）' })).toBeEnabled()
  })

  it('restores the draft after a reload during setup', () => {
    const first = setup()
    chooseCustomBoard(8)
    fireEvent.change(screen.getByLabelText('座位 1 角色'), {
      target: { value: 'seer' },
    })
    first.unmount()

    setup()

    expect(screen.getByLabelText('板子')).toHaveValue('custom')
    expect(screen.getAllByLabelText(/^座位 \d+ 角色$/)).toHaveLength(8)
    expect(screen.getByLabelText('座位 1 角色')).toHaveValue('seer')
  })

  it('restores the active game and its seat roles after a reload', () => {
    const first = startPhysicalGame()
    first.unmount()

    const { container } = setup()

    expect(screen.getByRole('heading', { name: '標準 333' })).toBeInTheDocument()
    expect(container.querySelectorAll('.game-seat')).toHaveLength(9)
    expect(within(seatCard(1)).getByText('狼人')).toBeInTheDocument()
    expect(within(seatCard(4)).getByText('預言家')).toBeInTheDocument()
  })

  it('restores the full saved seat record and alive count', () => {
    const seats = standardAssignments.map((roleId, index) => ({
      roleId,
      out: index === 0,
      copiedTarget: index === 1 ? 4 : null,
      usedFlags: {
        used: index === 2,
        antidoteUsed: false,
        poisonUsed: false,
      },
      tableStates: {
        badge: false,
        silenced: false,
        charmed: false,
        bound: false,
        dreamed: false,
        protected: true,
      },
    }))
    window.localStorage.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        draft: {
          boardId: 'standard-333',
          playerCount: 9,
          mode: 'physical',
          assignments: standardAssignments,
          revealedSeats: [],
        },
        game: {
          setup: {
            boardId: 'standard-333',
            playerCount: 9,
            mode: 'physical',
            assignments: standardAssignments,
          },
          seats,
        },
      }),
    )

    const { container } = setup()

    expect(screen.getByRole('heading', { name: '標準 333' })).toBeInTheDocument()
    expect(aliveCount(container)).toBe('8 / 9 在場')

    const saved = JSON.parse(
      window.localStorage.getItem(NOTEBOOK_STORAGE_KEY) ?? 'null',
    )
    expect(saved.game.seats).toEqual(seats)
  })

  it('discards an old event-log save and says so once', () => {
    window.localStorage.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        draft: {
          boardId: 'standard-333',
          playerCount: 9,
          mode: 'physical',
          assignments: standardAssignments,
          revealedSeats: [],
        },
        events: [{ type: 'start', setup: {} }],
      }),
    )

    const first = setup()

    expect(screen.getByRole('status')).toHaveTextContent(
      '舊版事件紀錄已清除',
    )
    expect(
      screen.getByRole('heading', { name: '把這一局記下來' }),
    ).toBeInTheDocument()

    first.unmount()
    setup()

    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('ignores a corrupt save without a legacy notice', () => {
    window.localStorage.setItem(NOTEBOOK_STORAGE_KEY, '{not json')

    setup()

    expect(
      screen.getByRole('heading', { name: '把這一局記下來' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('shows no old event log, phase, peek, or ability surfaces in play', () => {
    startPhysicalGame()

    expect(
      screen.queryByRole('button', { name: '事件記錄' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '復原上一步' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '進入白天' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: '目前階段' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '座位 4 查驗' }),
    ).not.toBeInTheDocument()
    expect(screen.queryByText('技能')).not.toBeInTheDocument()
    expect(
      screen.queryByText('每晚可以查驗一名玩家是好人還是狼人。'),
    ).not.toBeInTheDocument()
  })
})
