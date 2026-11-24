import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from './App'
import { NOTEBOOK_STORAGE_KEY } from './game/storage'

function setup() {
  return render(<App />)
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

function expectHiddenWolfAfterAwakenedHiddenWolf(select: HTMLElement) {
  const options = within(select)
    .getAllByRole('option')
    .map((option) => option.textContent?.trim())
  const hiddenIndex = options.indexOf('隱狼')

  expect(hiddenIndex).toBeGreaterThan(-1)
  expect(options[hiddenIndex - 1]).toBe('覺醒隱狼')
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

  it('discards a legacy notebook and says so once', async () => {
    window.localStorage.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        draft: {
          boardId: null,
          playerCount: 0,
          mode: 'digital',
          assignments: [],
          revealedSeats: [],
        },
        events: [],
      }),
    )

    setup()

    expect(screen.getByRole('status')).toHaveTextContent(
      '舊局紀錄已因日夜分類清除',
    )
    expect(
      screen.getByRole('heading', { name: '把這一局記下來' }),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '實體發牌' }))
    fireEvent.click(screen.getByRole('button', { name: '開始遊戲（實體）' }))
    fireEvent.click(screen.getByRole('button', { name: '清除這一局' }))
    fireEvent.click(screen.getByRole('button', { name: '清除遊戲' }))

    expect(
      await screen.findByRole('heading', { name: '把這一局記下來' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('deals every seat with judge-held reveals and starts the game', () => {
    const { container } = setup()

    fireEvent.click(screen.getByRole('button', { name: '發牌（數位）' }))

    expect(
      screen.getByRole('heading', { name: '逐座出示角色' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '開始遊戲' })).toBeDisabled()

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
    expect(container.querySelectorAll('.game-seat')).toHaveLength(9)
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

  it('starts a physical game straight from the setup grid', () => {
    setup()

    fireEvent.click(screen.getByRole('button', { name: '實體發牌' }))
    const start = screen.getByRole('button', { name: '開始遊戲（實體）' })
    expect(start).toBeEnabled()
    fireEvent.click(start)

    expect(screen.getByRole('heading', { name: '標準 333' })).toBeInTheDocument()
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
    expectHiddenWolfAfterAwakenedHiddenWolf(screen.getByLabelText('座位 1 角色'))

    chooseCustomBoard(9)
    expectHiddenWolfAfterAwakenedHiddenWolf(screen.getByLabelText('座位 1 角色'))
  })

  it('deals the hidden wolf and reveals only its role and camp', () => {
    setup()
    chooseCustomBoard(7)
    fireEvent.change(screen.getByLabelText('座位 1 角色'), {
      target: { value: 'hidden-wolf' },
    })
    fireEvent.click(screen.getByRole('button', { name: '發牌（數位）' }))

    const seat = screen
      .getAllByRole('button', { name: /^座位 \d+$/ })
      .find((button) => within(button).queryByText('隱狼'))
    if (!seat) throw new Error('hidden wolf seat not found')
    const seatNumber = seat.getAttribute('aria-label')?.replace('座位 ', '')
    fireEvent.click(seat)

    const dialog = screen.getByRole('dialog')
    expect(dialog.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      `數位發牌 · 只給 ${seatNumber} 號看狼人陣營隱狼完成取消出示`,
    )
  })
})

describe('dashboard', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  function startPhysicalGame() {
    setup()
    fireEvent.click(screen.getByRole('button', { name: '實體發牌' }))
    fireEvent.click(screen.getByRole('button', { name: '開始遊戲（實體）' }))
  }

  function openSeat(seat: number) {
    fireEvent.click(screen.getByRole('button', { name: `座位 ${seat} 詳情` }))
    return screen.getByRole('dialog', { name: `座位 ${seat} 狀態` })
  }

  it('uses seats as the only in-game surface', () => {
    startPhysicalGame()

    expect(
      screen.queryByRole('button', { name: '預言家 角色詳情' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: '查驗' }),
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '事件記錄' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '復原上一步' })).toBeInTheDocument()
  })

  it('starts in night 1 and advances phases from the header', () => {
    startPhysicalGame()

    expect(screen.getByText('第 1 夜')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '進入白天' }))
    expect(screen.getByText('第 1 天 · 白天')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '進入下一夜' }))
    expect(screen.getByText('第 2 夜')).toBeInTheDocument()
  })

  it('toggles the manual used flag from the seat sheet', () => {
    startPhysicalGame()

    const sheet = openSeat(4)
    const toggle = within(sheet).getByRole('button', { name: '座位 4 已使用' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(within(sheet).getByRole('button', { name: '關閉' }))
    expect(
      within(screen.getByRole('button', { name: '座位 4 詳情' })).getByText('已用'),
    ).toBeInTheDocument()
  })

  it('sets and clears a table state from the seat sheet', () => {
    startPhysicalGame()

    const sheet = openSeat(2)
    const toggle = within(sheet).getByRole('button', { name: '座位 2 禁言' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(screen.getByRole('button', { name: '座位 2 詳情' })).getByText('禁言'),
    ).toBeInTheDocument()

    fireEvent.click(toggle)

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(
      within(screen.getByRole('button', { name: '座位 2 詳情' })).queryByText(
        '禁言',
      ),
    ).not.toBeInTheDocument()
  })

  it('records an out player with a reason and undoes it', () => {
    startPhysicalGame()

    const sheet = openSeat(1)
    fireEvent.click(
      within(sheet).getByRole('button', { name: '座位 1 出局 夜間擊殺' }),
    )

    expect(within(sheet).getByText('已出局')).toBeInTheDocument()
    expect(
      within(sheet).queryByRole('button', { name: /座位 1 出局/ }),
    ).not.toBeInTheDocument()

    fireEvent.click(within(sheet).getByRole('button', { name: '關閉' }))
    const seat = screen.getByRole('button', { name: '座位 1 詳情' })
    expect(within(seat).getByText('出局 · 夜間擊殺')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '事件記錄' }))
    const log = screen.getByRole('dialog', { name: '事件記錄' })
    expect(
      within(log).getByText('1 號 狼人 出局（夜間擊殺）'),
    ).toBeInTheDocument()

    fireEvent.click(within(log).getByRole('button', { name: '關閉' }))
    fireEvent.click(screen.getByRole('button', { name: '復原上一步' }))

    expect(
      within(screen.getByRole('button', { name: '座位 1 詳情' })).queryByText(
        /出局/,
      ),
    ).not.toBeInTheDocument()
  })

  it('keeps peek available for an out seat', () => {
    startPhysicalGame()

    const sheet = openSeat(4)
    fireEvent.click(
      within(sheet).getByRole('button', { name: '座位 4 出局 夜間擊殺' }),
    )

    expect(within(sheet).getByText('已出局')).toBeInTheDocument()
    expect(
      within(sheet).getByRole('button', { name: '座位 4 查驗' }),
    ).toBeInTheDocument()
    expect(
      within(sheet).getByRole('button', { name: '座位 4 已使用' }),
    ).toBeInTheDocument()
  })

  it('shows catalog ability text and records tracked role state from the seat sheet', () => {
    startPhysicalGame()

    const sheet = openSeat(4)
    expect(
      within(sheet).getByText('每晚可以查驗一名玩家是好人還是狼人。'),
    ).toBeInTheDocument()

    fireEvent.click(
      within(sheet).getByRole('button', { name: '4 號 · 已查驗座位 5 號' }),
    )
    fireEvent.change(within(sheet).getByLabelText('4 號 · 最近查驗陣營'), {
      target: { value: 'wolf' },
    })

    expect(
      within(sheet).getByRole('button', { name: '4 號 · 已查驗座位 5 號' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(within(sheet).getByLabelText('4 號 · 最近查驗陣營')).toHaveValue(
      'wolf',
    )
  })

  it('offers peek only on roles with a peek ability', () => {
    startPhysicalGame()

    const witch = openSeat(5)
    expect(within(witch).getByText('技能')).toBeInTheDocument()
    expect(
      within(witch).queryByRole('button', { name: '座位 5 查驗' }),
    ).not.toBeInTheDocument()
    fireEvent.click(within(witch).getByRole('button', { name: '關閉' }))

    const villager = openSeat(9)
    expect(within(villager).queryByText('技能')).not.toBeInTheDocument()
    expect(
      within(villager).queryByRole('button', { name: '座位 9 已使用' }),
    ).not.toBeInTheDocument()
    expect(
      within(villager).queryByRole('button', { name: '座位 9 查驗' }),
    ).not.toBeInTheDocument()
  })

  it('records a judge-held peek from the seat sheet and warns before undoing it', () => {
    startPhysicalGame()

    const sheet = openSeat(4)
    fireEvent.click(within(sheet).getByRole('button', { name: '座位 4 查驗' }))

    const pickTarget = screen.getByRole('dialog', { name: '選擇查驗目標' })
    fireEvent.click(
      within(pickTarget).getByRole('button', { name: '查驗座位 1' }),
    )
    fireEvent.click(within(pickTarget).getByRole('button', { name: '下一步' }))

    const preview = screen.getByRole('dialog', { name: '查驗預覽' })
    expect(
      within(preview).getByText('狼人', { selector: '.peek-result__value' }),
    ).toBeInTheDocument()
    fireEvent.click(
      within(preview).getByRole('button', { name: '出示給玩家' }),
    )

    const reveal = screen.getByRole('dialog', { name: '查驗結果' })
    expect(
      within(reveal).getByRole('heading', { name: '狼人' }),
    ).toBeInTheDocument()
    fireEvent.click(within(reveal).getByRole('button', { name: '完成' }))

    const reopened = screen.getByRole('dialog', { name: '座位 4 狀態' })
    fireEvent.click(within(reopened).getByRole('button', { name: '關閉' }))

    fireEvent.click(screen.getByRole('button', { name: '事件記錄' }))
    const log = screen.getByRole('dialog', { name: '事件記錄' })
    expect(within(log).getByText(/預言家查驗 1 號 · 狼人/)).toBeInTheDocument()

    fireEvent.click(within(log).getByRole('button', { name: '關閉' }))
    fireEvent.click(screen.getByRole('button', { name: '復原上一步' }))
    const warning = screen.getByRole('alertdialog', { name: '復原查驗' })
    expect(within(warning).getByText(/不會讓玩家忘記/)).toBeInTheDocument()
    fireEvent.click(within(warning).getByRole('button', { name: '仍要復原' }))

    fireEvent.click(screen.getByRole('button', { name: '事件記錄' }))
    expect(
      within(screen.getByRole('dialog', { name: '事件記錄' })).queryByText(
        /預言家查驗/,
      ),
    ).not.toBeInTheDocument()
  })

  it('returns to the seat sheet when a peek is cancelled', () => {
    startPhysicalGame()

    const sheet = openSeat(4)
    fireEvent.click(within(sheet).getByRole('button', { name: '座位 4 查驗' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(
      screen.getByRole('dialog', { name: '座位 4 狀態' }),
    ).toBeInTheDocument()
  })

  it('overrides a peek to the exact role', () => {
    startPhysicalGame()

    const sheet = openSeat(4)
    fireEvent.click(within(sheet).getByRole('button', { name: '座位 4 查驗' }))
    fireEvent.click(screen.getByRole('button', { name: '查驗座位 4' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

    const preview = screen.getByRole('dialog', { name: '查驗預覽' })
    expect(
      within(preview).getByText('好人', { selector: '.peek-result__value' }),
    ).toBeInTheDocument()
    fireEvent.click(
      within(preview).getByRole('button', { name: '顯示確切角色' }),
    )
    expect(
      within(preview).getByText('預言家', { selector: '.peek-result__value' }),
    ).toBeInTheDocument()

    fireEvent.click(
      within(preview).getByRole('button', { name: '出示給玩家' }),
    )
    fireEvent.click(
      within(screen.getByRole('dialog', { name: '查驗結果' })).getByRole(
        'button',
        { name: '完成' },
      ),
    )

    fireEvent.click(screen.getByRole('button', { name: '事件記錄' }))
    expect(
      within(screen.getByRole('dialog', { name: '事件記錄' })).getByText(
        /預言家查驗 4 號 · 預言家/,
      ),
    ).toBeInTheDocument()
  })

  it('groups events into day and night cycle tabs', () => {
    startPhysicalGame()

    const sheet = openSeat(4)
    fireEvent.click(within(sheet).getByRole('button', { name: '座位 4 已使用' }))
    fireEvent.click(within(sheet).getByRole('button', { name: '關閉' }))

    fireEvent.click(screen.getByRole('button', { name: '進入白天' }))
    fireEvent.click(screen.getByRole('button', { name: '進入下一夜' }))

    fireEvent.click(screen.getByRole('button', { name: '事件記錄' }))
    const log = screen.getByRole('dialog', { name: '事件記錄' })

    expect(within(log).getByRole('tab', { name: '第 2 天' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(within(log).getByText('第 2 夜開始')).toBeInTheDocument()
    expect(within(log).getByText(/共 2 筆/)).toBeInTheDocument()
    expect(
      within(log).queryByRole('button', { name: '復原上一步' }),
    ).not.toBeInTheDocument()

    fireEvent.click(within(log).getByRole('tab', { name: '第 1 天' }))

    expect(within(log).getByText('第 1 天白天開始')).toBeInTheDocument()
    expect(within(log).getByText(/開始遊戲 · 實體發牌 · 9 人/)).toBeInTheDocument()
    expect(within(log).getByText(/標記為已使用/)).toBeInTheDocument()
  })

  it('undoes the last event from the dock', () => {
    startPhysicalGame()

    const sheet = openSeat(4)
    const toggle = within(sheet).getByRole('button', { name: '座位 4 已使用' })
    fireEvent.click(toggle)
    fireEvent.click(within(sheet).getByRole('button', { name: '關閉' }))

    fireEvent.click(screen.getByRole('button', { name: '復原上一步' }))

    const reopened = openSeat(4)
    expect(
      within(reopened).getByRole('button', { name: '座位 4 已使用' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('clears the game only after confirmation', async () => {
    startPhysicalGame()

    fireEvent.click(screen.getByRole('button', { name: '清除這一局' }))
    const dialog = screen.getByRole('alertdialog', { name: '清除這一局' })
    fireEvent.click(within(dialog).getByRole('button', { name: '取消' }))
    expect(screen.getByRole('heading', { name: '標準 333' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '清除這一局' }))
    fireEvent.click(screen.getByRole('button', { name: '清除遊戲' }))

    expect(
      await screen.findByRole('heading', { name: '把這一局記下來' }),
    ).toBeInTheDocument()
  })
})
