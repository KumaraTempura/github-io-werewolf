import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { createNotebook } from './state'
import {
  loadNotebook,
  NOTEBOOK_STORAGE_KEY,
  type KeyValueStorage,
} from './storage'
import { useNotebook } from './useNotebook'

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

describe('useNotebook', () => {
  it('autosaves draft edits and restores them on a fresh mount', () => {
    const storage = new MemoryStorage()
    const first = renderHook(() => useNotebook(storage))

    expect(first.result.current[0]).toEqual(createNotebook())

    act(() => {
      first.result.current[1]({ type: 'draft/setPlayerCount', playerCount: 9 })
    })
    act(() => {
      first.result.current[1]({
        type: 'draft/setAssignments',
        assignments: standardAssignments,
      })
    })
    act(() => {
      first.result.current[1]({ type: 'draft/setBoard', boardId: 'standard-333' })
    })

    expect(first.result.current[0].draft.assignments).toEqual(standardAssignments)
    const saved = loadNotebook(storage)
    expect(saved.draft.playerCount).toBe(9)

    first.unmount()
    const second = renderHook(() => useNotebook(storage))

    expect(second.result.current[0]).toEqual(saved)
  })

  it('reports a discarded legacy notebook once', () => {
    const storage = new MemoryStorage()
    storage.setItem(
      NOTEBOOK_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        draft: createNotebook().draft,
        events: [],
      }),
    )
    const first = renderHook(() => useNotebook(storage))

    expect(first.result.current[2]).toBe(true)
    first.unmount()

    const second = renderHook(() => useNotebook(storage))
    expect(second.result.current[2]).toBe(false)
  })

  it('restores an active game', () => {
    const storage = new MemoryStorage()
    const first = renderHook(() => useNotebook(storage))

    act(() => {
      first.result.current[1]({ type: 'draft/setPlayerCount', playerCount: 9 })
    })
    act(() => {
      first.result.current[1]({
        type: 'draft/setAssignments',
        assignments: standardAssignments,
      })
    })
    act(() => {
      first.result.current[1]({ type: 'game/start' })
    })
    act(() => {
      first.result.current[1]({
        type: 'game/append',
        event: { type: 'used', seat: 4, used: true },
      })
    })

    expect(first.result.current[0].events).toHaveLength(2)
    first.unmount()

    const second = renderHook(() => useNotebook(storage))

    expect(second.result.current[0]).toEqual(loadNotebook(storage))
    expect(second.result.current[0].events).toHaveLength(2)
  })
})
