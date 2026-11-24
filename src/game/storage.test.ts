import { describe, expect, it } from 'vitest'
import {
  appendEvent,
  createDraft,
  createNotebook,
  deriveGame,
  startGame,
  type NotebookState,
} from './state'
import {
  clearStoredNotebook,
  isLegacyNotebook,
  loadNotebook,
  NOTEBOOK_STORAGE_KEY,
  parseNotebook,
  saveNotebook,
  type KeyValueStorage,
} from './storage'

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

class MemoryStorage implements KeyValueStorage {
  private readonly data = new Map<string, string>()

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }
}

function draftState(): NotebookState {
  return {
    draft: createDraft({
      boardId: 'standard-333',
      playerCount: 9,
      mode: 'physical',
      assignments: standardAssignments,
      revealedSeats: [1, 2, 3],
    }),
    events: [],
  }
}

function playingState(): NotebookState {
  let state = draftState()
  state = { ...state, draft: { ...state.draft, revealedSeats: [1, 2, 3, 4, 5, 6, 7, 8, 9] } }
  const result = startGame(state)
  if (!result.ok) {
    throw new Error(result.error)
  }
  state = result.state
  state = appendEvent(state, { type: 'used', seat: 6, used: true })
  state = appendEvent(state, { type: 'elimination', seat: 2, reason: 'exile' })
  state = appendEvent(state, { type: 'phase', cycle: 1, phase: 'daytime' })
  state = appendEvent(state, {
    type: 'tableState',
    state: 'badge',
    seats: [7],
  })
  state = appendEvent(state, {
    type: 'note',
    seat: 4,
    text: '查驗 2 號是狼',
  })
  state = appendEvent(state, {
    type: 'peek',
    inspectorSeat: 4,
    targetSeat: 2,
    result: { kind: 'goodOrWolf', camp: 'wolf' },
  })
  state = appendEvent(state, {
    type: 'peek',
    inspectorSeat: 4,
    targetSeat: 2,
    targetSeats: [2, 7],
    result: { kind: 'goodOrWolf', camp: 'wolf' },
  })
  state = appendEvent(state, {
    type: 'roleState',
    seat: 5,
    field: 'antidoteRemaining',
    value: 0,
  })
  state = appendEvent(state, { type: 'phase', cycle: 2, phase: 'night' })
  return state
}

describe('storage', () => {
  it('round-trips a draft', () => {
    const storage = new MemoryStorage()
    const state = draftState()

    expect(saveNotebook(state, storage)).toBe(true)
    expect(loadNotebook(storage)).toEqual(state)
  })

  it('round-trips an active game', () => {
    const storage = new MemoryStorage()
    const state = playingState()

    expect(saveNotebook(state, storage)).toBe(true)
    const loaded = loadNotebook(storage)

    expect(loaded).toEqual(state)
    expect(deriveGame(loaded.events)).toEqual(deriveGame(state.events))
  })

  it('returns a fresh notebook when nothing is stored', () => {
    expect(loadNotebook(new MemoryStorage())).toEqual(createNotebook())
  })

  it('ignores corrupted or unsupported data', () => {
    const corrupted = new MemoryStorage()
    corrupted.setItem(NOTEBOOK_STORAGE_KEY, '{not json')
    expect(loadNotebook(corrupted)).toEqual(createNotebook())

    const oldVersion = new MemoryStorage()
    oldVersion.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({ ...draftState(), version: 99 }),
    )
    expect(loadNotebook(oldVersion)).toEqual(createNotebook())

    const invalidDraft = new MemoryStorage()
    invalidDraft.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        draft: { ...draftState().draft, assignments: ['no-such-role'] },
        events: [],
      }),
    )
    expect(loadNotebook(invalidDraft)).toEqual(createNotebook())
  })

  it('rejects an out-of-order phase event', () => {
    const storage = new MemoryStorage()
    const state = playingState()
    const start = state.events[0]
    storage.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        draft: state.draft,
        events: [start, { type: 'phase', cycle: 2, phase: 'night' }],
      }),
    )

    expect(loadNotebook(storage)).toEqual(createNotebook())
  })

  it('flags a version 1 notebook for the discard notice', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({ version: 1, draft: draftState().draft, events: [] }),
    )

    expect(isLegacyNotebook(storage)).toBe(true)
    expect(loadNotebook(storage)).toEqual(createNotebook())
  })

  it('does not flag current, absent, or corrupt notebooks', () => {
    const current = new MemoryStorage()
    saveNotebook(draftState(), current)
    expect(isLegacyNotebook(current)).toBe(false)

    expect(isLegacyNotebook(new MemoryStorage())).toBe(false)

    const corrupt = new MemoryStorage()
    corrupt.setItem(NOTEBOOK_STORAGE_KEY, '{not json')
    expect(isLegacyNotebook(corrupt)).toBe(false)
  })

  it('rejects a stored log the core would not accept', () => {
    const storage = new MemoryStorage()
    const stored = {
      ...playingState(),
      version: 2,
      events: playingState().events.map((event, index) =>
        index === 1 ? { ...event, seat: 99 } : event,
      ),
    }
    storage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(stored))

    expect(loadNotebook(storage)).toEqual(createNotebook())
  })

  it('rejects a stored start that disagrees with the draft', () => {
    const storage = new MemoryStorage()
    const state = playingState()
    const start = state.events[0]
    if (start.type !== 'start') {
      throw new Error('expected start event')
    }
    storage.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        draft: { ...state.draft, assignments: [...standardAssignments].reverse() },
        events: state.events,
      }),
    )

    expect(loadNotebook(storage)).toEqual(createNotebook())
    expect(parseNotebook(JSON.parse(storage.getItem(NOTEBOOK_STORAGE_KEY) ?? 'null'))).toBeNull()
  })

  it('clears stored data', () => {
    const storage = new MemoryStorage()
    saveNotebook(playingState(), storage)

    clearStoredNotebook(storage)

    expect(loadNotebook(storage)).toEqual(createNotebook())
  })

  it('uses window.localStorage by default', () => {
    window.localStorage.clear()
    const state = playingState()

    saveNotebook(state)
    expect(loadNotebook()).toEqual(state)

    clearStoredNotebook()
    expect(loadNotebook()).toEqual(createNotebook())
  })
})
