import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  appendEvent,
  createDraft,
  deriveGame,
  startGame,
  type DerivedGame,
  type InGameEvent,
} from '../game/state'
import PeekFlow from './PeekFlow'

const ASSIGNMENTS = [
  'wolf',
  'wolf',
  'wolf',
  'seer',
  'mirror-maiden',
  'gargoyle',
  'gravekeeper',
  'scent-phantom',
  'raven-claw',
  'awakened-hidden-wolf',
  'awakened-seer',
  'villager',
]

function gameWith(events: InGameEvent[] = []): DerivedGame {
  const draft = createDraft({
    boardId: null,
    playerCount: ASSIGNMENTS.length,
    mode: 'physical',
    assignments: ASSIGNMENTS,
    revealedSeats: ASSIGNMENTS.map((_, index) => index + 1),
  })
  const started = startGame({ draft, events: [] })
  if (!started.ok) {
    throw new Error(started.error)
  }
  let state = started.state
  for (const event of events) {
    state = appendEvent(state, event)
  }
  const game = deriveGame(state.events)
  if (!game) {
    throw new Error('expected a derived game')
  }
  return game
}

afterEach(() => {
  cleanup()
})

describe('PeekFlow', () => {
  it('records a two-seat awakened seer peek as one event', () => {
    const dispatch = vi.fn()
    const onClose = vi.fn()
    render(
      <PeekFlow
        game={gameWith()}
        dispatch={dispatch}
        inspectorSeat={11}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '查驗座位 1' }))
    fireEvent.click(screen.getByRole('button', { name: '查驗座位 12' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

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

    expect(dispatch).toHaveBeenCalledWith({
      type: 'game/append',
      event: {
        type: 'peek',
        inspectorSeat: 11,
        targetSeat: 1,
        targetSeats: [1, 12],
        result: { kind: 'goodOrWolf', camp: 'wolf' },
      },
    })
    expect(onClose).toHaveBeenCalled()
  })

  it('uses the last exiled seat for a gravekeeper peek', () => {
    const dispatch = vi.fn()
    const onClose = vi.fn()
    render(
      <PeekFlow
        game={gameWith([{ type: 'elimination', seat: 4, reason: 'exile' }])}
        dispatch={dispatch}
        inspectorSeat={7}
        onClose={onClose}
      />,
    )

    const preview = screen.getByRole('dialog', { name: '查驗預覽' })
    expect(
      within(preview).getByText('上一個被放逐：4 號'),
    ).toBeInTheDocument()
    expect(
      within(preview).getByText('上次放逐：好人', {
        selector: '.peek-result__value',
      }),
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

    expect(dispatch).toHaveBeenCalledWith({
      type: 'game/append',
      event: {
        type: 'peek',
        inspectorSeat: 7,
        targetSeat: 4,
        result: { kind: 'lastExileCamp', camp: 'good' },
      },
    })
  })

  it('offers the known teammates by default', () => {
    render(
      <PeekFlow
        game={gameWith()}
        dispatch={vi.fn()}
        inspectorSeat={9}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: '隊友座位 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '隊友座位 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: '下一步' })).toBeEnabled()
  })

  it('returns to the seat when cancelled', () => {
    const onClose = vi.fn()
    render(
      <PeekFlow
        game={gameWith()}
        dispatch={vi.fn()}
        inspectorSeat={11}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('returns to the seat when the reveal is cancelled', () => {
    const onClose = vi.fn()
    render(
      <PeekFlow
        game={gameWith()}
        dispatch={vi.fn()}
        inspectorSeat={11}
        onClose={onClose}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '查驗座位 1' }))
    fireEvent.click(screen.getByRole('button', { name: '查驗座位 12' }))
    fireEvent.click(screen.getByRole('button', { name: '下一步' }))
    fireEvent.click(screen.getByRole('button', { name: '出示給玩家' }))
    fireEvent.click(screen.getByRole('button', { name: '取消' }))

    expect(onClose).toHaveBeenCalled()
  })

  it('renders nothing for a role without a peek ability', () => {
    const { container } = render(
      <PeekFlow
        game={gameWith()}
        dispatch={vi.fn()}
        inspectorSeat={12}
        onClose={vi.fn()}
      />,
    )

    expect(container).toBeEmptyDOMElement()
  })
})
