import { describe, expect, it } from 'vitest'
import {
  appendEvent,
  createDraft,
  createNotebook,
  deriveGame,
  isPlaying,
  nextPhase,
  notebookReducer,
  startGame,
  undoLast,
  type DraftState,
  type InGameEvent,
  type NotebookAction,
  type NotebookState,
} from './state'

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

const allRevealed = [1, 2, 3, 4, 5, 6, 7, 8, 9]

function draftWith(overrides: Partial<DraftState> = {}): DraftState {
  return createDraft({
    boardId: 'standard-333',
    playerCount: standardAssignments.length,
    assignments: standardAssignments,
    ...overrides,
  })
}

function setupState(overrides: Partial<DraftState> = {}): NotebookState {
  return { draft: draftWith(overrides), events: [] }
}

function started(overrides: Partial<DraftState> = {}): NotebookState {
  const result = startGame(setupState(overrides))
  if (!result.ok) {
    throw new Error(`start failed: ${result.error}`)
  }
  return result.state
}

function derivedOf(state: NotebookState) {
  const derived = deriveGame(state.events)
  if (!derived) {
    throw new Error('expected an active game')
  }
  return derived
}

describe('draft', () => {
  it('starts in setup with an empty draft', () => {
    const state = createNotebook()

    expect(isPlaying(state)).toBe(false)
    expect(state.draft).toEqual({
      boardId: null,
      playerCount: 0,
      mode: 'digital',
      assignments: [],
      revealedSeats: [],
    })
    expect(deriveGame(state.events)).toBeNull()
  })

  it('records draft edits without creating events', () => {
    let state = setupState()

    state = notebookReducer(state, { type: 'draft/setBoard', boardId: 'standard-444' })
    state = notebookReducer(state, { type: 'draft/setMode', mode: 'physical' })
    state = notebookReducer(state, { type: 'draft/setAssignment', seat: 1, roleId: 'seer' })
    state = notebookReducer(state, { type: 'draft/swapSeats', a: 1, b: 2 })
    state = notebookReducer(state, { type: 'draft/setReveal', seat: 3, revealed: true })
    state = notebookReducer(state, { type: 'draft/setReveal', seat: 4, revealed: true })
    state = notebookReducer(state, { type: 'draft/setReveal', seat: 3, revealed: false })

    expect(state.events).toEqual([])
    expect(isPlaying(state)).toBe(false)
    expect(state.draft.boardId).toBe('standard-444')
    expect(state.draft.mode).toBe('physical')
    expect(state.draft.assignments[0]).toBe('wolf')
    expect(state.draft.assignments[1]).toBe('seer')
    expect(state.draft.revealedSeats).toEqual([4])
  })

  it('resizes the draft and drops out-of-range entries', () => {
    let state = setupState()
    state = notebookReducer(state, { type: 'draft/setReveal', seat: 8, revealed: true })
    state = notebookReducer(state, { type: 'draft/setPlayerCount', playerCount: 3 })

    expect(state.draft.playerCount).toBe(3)
    expect(state.draft.assignments).toEqual(['wolf', 'wolf', 'wolf'])
    expect(state.draft.revealedSeats).toEqual([])

    state = notebookReducer(state, { type: 'draft/setPlayerCount', playerCount: 5 })

    expect(state.draft.assignments).toEqual(['wolf', 'wolf', 'wolf', null, null])
    expect(state.draft.revealedSeats).toEqual([])
  })

  it('replaces every assignment at once', () => {
    let state = setupState()
    const custom = Array.from({ length: 9 }, () => 'villager')

    state = notebookReducer(state, { type: 'draft/setBoard', boardId: null })
    state = notebookReducer(state, { type: 'draft/setAssignments', assignments: custom })

    expect(state.draft.boardId).toBeNull()
    expect(state.draft.assignments).toEqual(custom)
    expect(state.events).toEqual([])
  })

  it('deals roles and reveal progress as draft state', () => {
    let state = createNotebook()
    const dealt = ['seer', 'wolf', 'villager', 'hunter', 'witch']

    state = notebookReducer(state, { type: 'draft/setPlayerCount', playerCount: 5 })
    state = notebookReducer(state, { type: 'draft/setMode', mode: 'digital' })
    state = notebookReducer(state, { type: 'draft/setAssignments', assignments: dealt })
    state = notebookReducer(state, { type: 'draft/setReveal', seat: 1, revealed: true })
    state = notebookReducer(state, { type: 'draft/setReveal', seat: 2, revealed: true })

    expect(state.events).toEqual([])
    expect(state.draft.assignments).toEqual(dealt)
    expect(state.draft.revealedSeats).toEqual([1, 2])
  })

  it('rejects invalid draft edits', () => {
    const before = setupState()
    const actions: NotebookAction[] = [
      { type: 'draft/setBoard', boardId: 'no-such-board' },
      { type: 'draft/setPlayerCount', playerCount: -1 },
      { type: 'draft/setAssignment', seat: 0, roleId: 'seer' },
      { type: 'draft/setAssignment', seat: 10, roleId: 'seer' },
      { type: 'draft/setAssignment', seat: 1, roleId: 'no-such-role' },
      { type: 'draft/setAssignments', assignments: ['seer'] },
      { type: 'draft/swapSeats', a: 0, b: 1 },
      { type: 'draft/setReveal', seat: 10, revealed: true },
    ]

    let state = before
    for (const action of actions) {
      state = notebookReducer(state, action)
      expect(state.draft).toEqual(before.draft)
    }
  })
})

describe('start', () => {
  it('commits the draft as one start event and derives the game', () => {
    const state = started()

    expect(state.events).toHaveLength(1)
    const event = state.events[0]
    expect(event.type).toBe('start')
    if (event.type !== 'start') {
      return
    }
    expect(event.setup).toEqual({
      boardId: 'standard-333',
      playerCount: 9,
      mode: 'digital',
      assignments: standardAssignments,
    })
    expect(isPlaying(state)).toBe(true)

    const derived = derivedOf(state)
    expect(derived.setup).toEqual(event.setup)
    expect(derived.seatRoles).toEqual({
      1: 'wolf',
      2: 'wolf',
      3: 'wolf',
      4: 'seer',
      5: 'witch',
      6: 'hunter',
      7: 'villager',
      8: 'villager',
      9: 'villager',
    })
    expect(derived.usedBySeat).toEqual({
      1: false,
      2: false,
      3: false,
      4: false,
      5: false,
      6: false,
      7: false,
      8: false,
      9: false,
    })
    expect(derived.roleStateBySeat[4]).toEqual({
      checkedSeats: [],
      lastCheckTarget: null,
      lastCheckCamp: null,
    })
    expect(derived.roleStateBySeat[5]).toEqual({
      antidoteRemaining: 1,
      poisonRemaining: 1,
      potionUsedThisNight: null,
      savedSeat: null,
      poisonedSeat: null,
    })
    expect(derived.tableStates).toEqual({
      badge: [],
      silenced: [],
      charmed: [],
      bound: [],
      dreamed: [],
      poisoned: [],
    })
    expect(derived.outPlayers).toEqual([])
    expect(derived.notes).toEqual([])
    expect(derived.peeks).toEqual([])
    expect(derived.history).toEqual(state.events)
  })

  it('rejects incomplete or invalid drafts', () => {
    expect(startGame(createNotebook())).toEqual({
      ok: false,
      error: 'invalid-player-count',
    })

    const gap = setupState()
    gap.draft.assignments[0] = null
    expect(startGame(gap)).toEqual({
      ok: false,
      error: 'incomplete-assignments',
    })

    expect(startGame(setupState({ playerCount: 10 }))).toEqual({
      ok: false,
      error: 'incomplete-assignments',
    })

    const unknownRole = setupState({
      assignments: ['no-such-role', ...standardAssignments.slice(1)],
    })
    expect(startGame(unknownRole)).toEqual({
      ok: false,
      error: 'unknown-role',
    })

    expect(startGame(setupState({ boardId: 'no-such-board' }))).toEqual({
      ok: false,
      error: 'unknown-board',
    })

    expect(startGame(started())).toEqual({
      ok: false,
      error: 'already-started',
    })
  })

  it('freezes the draft once the game starts', () => {
    const state = started()
    const draft = state.draft

    let next = notebookReducer(state, {
      type: 'draft/setAssignment',
      seat: 1,
      roleId: 'seer',
    })
    next = notebookReducer(next, { type: 'draft/setPlayerCount', playerCount: 3 })
    next = notebookReducer(next, { type: 'draft/setReveal', seat: 1, revealed: true })

    expect(next.draft).toEqual(draft)
    expect(next.events).toEqual(state.events)
  })
})

describe('phase', () => {
  it('starts in the first night', () => {
    expect(derivedOf(started()).currentPhase).toEqual({ cycle: 1, phase: 'night' })
  })

  it('advances to daytime and then to the next night', () => {
    let state = started()

    state = appendEvent(state, { type: 'phase', cycle: 1, phase: 'daytime' })
    expect(derivedOf(state).currentPhase).toEqual({ cycle: 1, phase: 'daytime' })

    state = appendEvent(state, { type: 'phase', cycle: 2, phase: 'night' })
    expect(derivedOf(state).currentPhase).toEqual({ cycle: 2, phase: 'night' })
    expect(state.events).toHaveLength(3)
  })

  it('computes the next phase', () => {
    expect(nextPhase({ cycle: 1, phase: 'night' })).toEqual({
      cycle: 1,
      phase: 'daytime',
    })
    expect(nextPhase({ cycle: 1, phase: 'daytime' })).toEqual({
      cycle: 2,
      phase: 'night',
    })
  })

  it('rejects out-of-order phase events', () => {
    let state = started()
    const invalid: InGameEvent[] = [
      { type: 'phase', cycle: 1, phase: 'night' },
      { type: 'phase', cycle: 2, phase: 'night' },
      { type: 'phase', cycle: 2, phase: 'daytime' },
      { type: 'phase', cycle: 0, phase: 'daytime' },
    ]

    for (const event of invalid) {
      expect(appendEvent(state, event)).toBe(state)
    }

    state = appendEvent(state, { type: 'phase', cycle: 1, phase: 'daytime' })
    expect(appendEvent(state, { type: 'phase', cycle: 1, phase: 'daytime' })).toBe(
      state,
    )
    expect(appendEvent(state, { type: 'phase', cycle: 3, phase: 'night' })).toBe(
      state,
    )
    expect(appendEvent(state, { type: 'phase', cycle: 2, phase: 'night' })).not.toBe(
      state,
    )
  })

  it('undoes a phase advance', () => {
    let state = started()
    state = appendEvent(state, { type: 'phase', cycle: 1, phase: 'daytime' })

    state = undoLast(state)

    expect(derivedOf(state).currentPhase).toEqual({ cycle: 1, phase: 'night' })
  })
})

describe('undo', () => {
  it('undoes Start back to the drafted setup', () => {
    const setup = setupState({ revealedSeats: allRevealed })
    const result = startGame(setup)
    if (!result.ok) {
      throw new Error(result.error)
    }

    const undone = undoLast(result.state)

    expect(undone.events).toEqual([])
    expect(undone.draft).toEqual(setup.draft)
    expect(undone.draft.revealedSeats).toEqual(allRevealed)
    expect(isPlaying(undone)).toBe(false)
    expect(deriveGame(undone.events)).toBeNull()
  })

  it('restores the previous derived state exactly', () => {
    let state = started()
    state = appendEvent(state, { type: 'used', seat: 6, used: true })
    const snapshot = derivedOf(state)

    state = appendEvent(state, {
      type: 'roleState',
      seat: 5,
      field: 'antidoteRemaining',
      value: 0,
    })
    expect(derivedOf(state).roleStateBySeat[5]?.antidoteRemaining).toBe(0)

    state = undoLast(state)

    expect(derivedOf(state)).toEqual(snapshot)
  })

  it('does nothing with an empty log', () => {
    const state = setupState()

    expect(undoLast(state)).toBe(state)
    expect(notebookReducer(state, { type: 'game/undo' })).toBe(state)
  })
})

describe('in-game events', () => {
  it('records used flags', () => {
    let state = started()

    state = appendEvent(state, { type: 'used', seat: 6, used: true })
    expect(derivedOf(state).usedBySeat[6]).toBe(true)

    state = appendEvent(state, { type: 'used', seat: 6, used: false })
    expect(derivedOf(state).usedBySeat[6]).toBe(false)
    expect(state.events).toHaveLength(3)
  })

  it('records role-state edits per seat', () => {
    let state = started()

    state = appendEvent(state, {
      type: 'roleState',
      seat: 5,
      field: 'antidoteRemaining',
      value: 0,
    })
    state = appendEvent(state, {
      type: 'roleState',
      seat: 4,
      field: 'checkedSeats',
      value: [2],
    })
    state = appendEvent(state, {
      type: 'roleState',
      seat: 4,
      field: 'lastCheckTarget',
      value: 2,
    })
    state = appendEvent(state, {
      type: 'roleState',
      seat: 4,
      field: 'lastCheckCamp',
      value: 'wolf',
    })

    const derived = derivedOf(state)
    expect(derived.roleStateBySeat[5]?.antidoteRemaining).toBe(0)
    expect(derived.roleStateBySeat[4]).toEqual({
      checkedSeats: [2],
      lastCheckTarget: 2,
      lastCheckCamp: 'wolf',
    })
    expect(derived.roleStateBySeat[1]).toEqual({ killTarget: null })

    const before = state.events.length
    state = appendEvent(state, {
      type: 'roleState',
      seat: 5,
      field: 'no-such-field',
      value: 1,
    })
    state = appendEvent(state, {
      type: 'roleState',
      seat: 5,
      field: 'antidoteRemaining',
      value: 2,
    })
    state = appendEvent(state, {
      type: 'roleState',
      seat: 4,
      field: 'antidoteRemaining',
      value: 0,
    })

    expect(state.events).toHaveLength(before)
  })

  it('records judge-set table states', () => {
    let state = started()

    state = appendEvent(state, { type: 'tableState', state: 'badge', seats: [2] })
    state = appendEvent(state, { type: 'tableState', state: 'silenced', seats: [3] })
    state = appendEvent(state, { type: 'tableState', state: 'bound', seats: [1, 4] })
    state = appendEvent(state, { type: 'tableState', state: 'poisoned', seats: [5] })

    expect(derivedOf(state).tableStates).toEqual({
      badge: [2],
      silenced: [3],
      charmed: [],
      bound: [1, 4],
      dreamed: [],
      poisoned: [5],
    })

    state = appendEvent(state, { type: 'tableState', state: 'badge', seats: [7] })
    expect(derivedOf(state).tableStates.badge).toEqual([7])

    const rejected = appendEvent(state, {
      type: 'tableState',
      state: 'badge',
      seats: [10],
    })
    expect(rejected).toBe(state)

    state = undoLast(state)
    expect(derivedOf(state).tableStates.badge).toEqual([2])

    state = appendEvent(state, { type: 'tableState', state: 'silenced', seats: [] })
    expect(derivedOf(state).tableStates.silenced).toEqual([])
  })

  it('records eliminations with a reason', () => {
    let state = started()

    state = appendEvent(state, { type: 'elimination', seat: 5, reason: 'nightKill' })
    state = appendEvent(state, { type: 'elimination', seat: 2, reason: 'exile' })

    expect(derivedOf(state).outPlayers).toEqual([
      { seat: 5, reason: 'nightKill' },
      { seat: 2, reason: 'exile' },
    ])

    const rejected = appendEvent(state, {
      type: 'elimination',
      seat: 5,
      reason: 'poison',
    })
    expect(rejected).toBe(state)

    state = undoLast(state)
    expect(derivedOf(state).outPlayers).toEqual([
      { seat: 5, reason: 'nightKill' },
    ])
  })

  it('revives an out player', () => {
    let state = started()

    state = appendEvent(state, { type: 'elimination', seat: 5, reason: 'nightKill' })
    state = appendEvent(state, { type: 'revive', seat: 5 })

    expect(derivedOf(state).outPlayers).toEqual([])
    expect(state.events).toHaveLength(3)
  })

  it('rejects a revive when the seat is not out', () => {
    const state = started()

    expect(appendEvent(state, { type: 'revive', seat: 5 })).toBe(state)
  })

  it('allows a second elimination after a revive', () => {
    let state = started()

    state = appendEvent(state, { type: 'elimination', seat: 5, reason: 'nightKill' })
    state = appendEvent(state, { type: 'revive', seat: 5 })
    state = appendEvent(state, { type: 'elimination', seat: 5, reason: 'exile' })

    expect(derivedOf(state).outPlayers).toEqual([{ seat: 5, reason: 'exile' }])
  })

  it('undoes a revive', () => {
    let state = started()

    state = appendEvent(state, { type: 'elimination', seat: 5, reason: 'nightKill' })
    state = appendEvent(state, { type: 'revive', seat: 5 })
    state = undoLast(state)

    expect(derivedOf(state).outPlayers).toEqual([{ seat: 5, reason: 'nightKill' }])
  })

  it('accepts every elimination reason', () => {
    const reasons = [
      'nightKill',
      'exile',
      'poison',
      'shot',
      'selfExpose',
      'bomb',
      'chained',
      'other',
    ] as const
    let state = started()

    reasons.forEach((reason, index) => {
      state = appendEvent(state, { type: 'elimination', seat: index + 1, reason })
    })

    expect(derivedOf(state).outPlayers.map((player) => player.reason)).toEqual([
      ...reasons,
    ])
  })

  it('records notes with an optional seat', () => {
    let state = started()

    state = appendEvent(state, { type: 'note', seat: 4, text: '  查驗 2 號  ' })
    state = appendEvent(state, { type: 'note', seat: null, text: '全域備註' })

    expect(derivedOf(state).notes).toEqual([
      { seat: 4, text: '查驗 2 號' },
      { seat: null, text: '全域備註' },
    ])

    const before = state.events.length
    state = appendEvent(state, { type: 'note', seat: 1, text: '   ' })
    state = appendEvent(state, { type: 'note', seat: 10, text: 'x' })
    expect(state.events).toHaveLength(before)

    state = undoLast(state)
    expect(derivedOf(state).notes).toHaveLength(1)
  })

  it('records peeks', () => {
    let state = started()

    state = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 4,
      targetSeat: 2,
      result: { kind: 'goodOrWolf', camp: 'wolf' },
    })
    state = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 4,
      targetSeat: 3,
      result: { kind: 'exactRole', roleId: 'wolf' },
    })
    state = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 3,
      targetSeat: 4,
      result: { kind: 'teammateNumber', seats: [1, 2] },
    })
    state = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 5,
      targetSeat: 6,
      result: { kind: 'lastExileCamp', camp: 'good' },
    })

    expect(derivedOf(state).peeks).toEqual([
      {
        inspectorSeat: 4,
        targetSeat: 2,
        result: { kind: 'goodOrWolf', camp: 'wolf' },
      },
      {
        inspectorSeat: 4,
        targetSeat: 3,
        result: { kind: 'exactRole', roleId: 'wolf' },
      },
      {
        inspectorSeat: 3,
        targetSeat: 4,
        result: { kind: 'teammateNumber', seats: [1, 2] },
      },
      {
        inspectorSeat: 5,
        targetSeat: 6,
        result: { kind: 'lastExileCamp', camp: 'good' },
      },
    ])

    const before = state.events.length
    state = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 4,
      targetSeat: 10,
      result: { kind: 'goodOrWolf', camp: 'good' },
    })
    state = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 4,
      targetSeat: 2,
      result: { kind: 'exactRole', roleId: 'no-such-role' },
    })
    expect(state.events).toHaveLength(before)

    state = undoLast(state)
    expect(derivedOf(state).peeks).toHaveLength(3)
  })

  it('applies peek role-state updates atomically', () => {
    let state = started()

    state = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 4,
      targetSeat: 2,
      result: { kind: 'goodOrWolf', camp: 'wolf' },
      updates: [
        { field: 'checkedSeats', value: [2] },
        { field: 'lastCheckTarget', value: 2 },
        { field: 'lastCheckCamp', value: 'wolf' },
      ],
    })

    expect(derivedOf(state).roleStateBySeat[4]).toEqual({
      checkedSeats: [2],
      lastCheckTarget: 2,
      lastCheckCamp: 'wolf',
    })

    state = undoLast(state)

    expect(derivedOf(state).roleStateBySeat[4]).toEqual({
      checkedSeats: [],
      lastCheckTarget: null,
      lastCheckCamp: null,
    })
  })

  it('rejects peek updates that do not belong to the inspector role', () => {
    const state = started()

    const rejected = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 4,
      targetSeat: 2,
      result: { kind: 'goodOrWolf', camp: 'wolf' },
      updates: [{ field: 'antidoteRemaining', value: 0 }],
    })

    expect(rejected).toBe(state)
  })

  it('records multi-target peeks', () => {
    let state = started()

    state = appendEvent(state, {
      type: 'peek',
      inspectorSeat: 4,
      targetSeat: 2,
      targetSeats: [2, 3],
      result: { kind: 'goodOrWolf', camp: 'wolf' },
    })

    expect(derivedOf(state).peeks).toEqual([
      {
        inspectorSeat: 4,
        targetSeat: 2,
        targetSeats: [2, 3],
        result: { kind: 'goodOrWolf', camp: 'wolf' },
      },
    ])

    const before = state.events.length
    for (const targetSeats of [[], [2, 10], [2, 2], [3, 2]]) {
      state = appendEvent(state, {
        type: 'peek',
        inspectorSeat: 4,
        targetSeat: 2,
        targetSeats,
        result: { kind: 'goodOrWolf', camp: 'wolf' },
      })
    }
    expect(state.events).toHaveLength(before)
  })

  it('ignores events when no game is active', () => {
    const state = setupState()

    expect(appendEvent(state, { type: 'used', seat: 1, used: true })).toBe(state)
  })

  it('keeps seat references inside the board', () => {
    const state = started()

    expect(appendEvent(state, { type: 'used', seat: 0, used: true })).toBe(state)
    expect(appendEvent(state, { type: 'used', seat: 10, used: true })).toBe(state)
  })
})

describe('clear', () => {
  it('clears the draft and the active game', () => {
    const cleared = notebookReducer(started(), { type: 'game/clear' })

    expect(cleared).toEqual(createNotebook())
  })
})
