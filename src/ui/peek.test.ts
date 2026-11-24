import { describe, expect, it } from 'vitest'
import { getRole, initialTrackedState } from '../data/catalog'
import {
  appendEvent,
  createDraft,
  deriveGame,
  startGame,
  type DerivedGame,
  type InGameEvent,
} from '../game/state'
import {
  computeCatalogResult,
  defaultTeammateTargets,
  exactRoleFor,
  hasEnoughTargets,
  initialPeekState,
  lastExiledSeat,
  peekRoleStateUpdates,
  planPeek,
} from './peek'

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

describe('planPeek', () => {
  it('maps catalog peek kinds to target selection modes', () => {
    const role = (id: string) => getRole(id) ?? null

    expect(planPeek(role('seer'))).toMatchObject({ mode: 'single', targetCount: 1 })
    expect(planPeek(role('awakened-seer'))).toMatchObject({
      mode: 'pair',
      targetCount: 2,
    })
    expect(planPeek(role('mirror-maiden'))).toMatchObject({ mode: 'single' })
    expect(planPeek(role('scent-phantom'))).toMatchObject({ mode: 'teammates' })
    expect(planPeek(role('raven-claw'))).toMatchObject({ mode: 'teammates' })
    expect(planPeek(role('gravekeeper'))).toMatchObject({ mode: 'lastExile' })
    expect(planPeek(role('villager'))).toMatchObject({ mode: 'custom' })
    expect(planPeek(null)).toMatchObject({ mode: 'custom' })
  })
})

describe('hasEnoughTargets', () => {
  it('requires one target for single and custom, two for pair', () => {
    const role = (id: string) => getRole(id) ?? null
    expect(hasEnoughTargets(planPeek(role('seer')), 0)).toBe(false)
    expect(hasEnoughTargets(planPeek(role('seer')), 1)).toBe(true)
    expect(hasEnoughTargets(planPeek(role('awakened-seer')), 1)).toBe(false)
    expect(hasEnoughTargets(planPeek(role('awakened-seer')), 2)).toBe(true)
    expect(hasEnoughTargets(planPeek(role('raven-claw')), 0)).toBe(true)
    expect(hasEnoughTargets(planPeek(role('villager')), 1)).toBe(true)
  })
})

describe('exactRoleFor', () => {
  it('shows the mimicked role to the mirror maiden only', () => {
    const game = gameWith([
      { type: 'roleState', seat: 10, field: 'mimickedRole', value: 'seer' },
    ])

    expect(exactRoleFor(game, 5, 10)).toBe('seer')
    expect(exactRoleFor(game, 6, 10)).toBe('awakened-hidden-wolf')
    expect(exactRoleFor(game, 5, 12)).toBe('villager')
  })

  it('shows the awakened hidden wolf when it never mimicked', () => {
    const game = gameWith()
    expect(exactRoleFor(game, 5, 10)).toBe('awakened-hidden-wolf')
  })
})

describe('computeCatalogResult', () => {
  it('reports good or wolf for the seer', () => {
    const game = gameWith()

    expect(computeCatalogResult(game, 4, [1])).toEqual({
      kind: 'goodOrWolf',
      camp: 'wolf',
    })
    expect(computeCatalogResult(game, 4, [12])).toEqual({
      kind: 'goodOrWolf',
      camp: 'good',
    })
  })

  it('combines a two-seat awakened seer check into one camp', () => {
    const game = gameWith()

    expect(computeCatalogResult(game, 11, [1, 12])).toEqual({
      kind: 'goodOrWolf',
      camp: 'wolf',
    })
    expect(computeCatalogResult(game, 11, [4, 12])).toEqual({
      kind: 'goodOrWolf',
      camp: 'good',
    })
  })

  it('reports exact roles with the mirror maiden exception', () => {
    const game = gameWith([
      { type: 'roleState', seat: 10, field: 'mimickedRole', value: 'seer' },
    ])

    expect(computeCatalogResult(game, 6, [10])).toEqual({
      kind: 'exactRole',
      roleId: 'awakened-hidden-wolf',
    })
    expect(computeCatalogResult(game, 5, [10])).toEqual({
      kind: 'exactRole',
      roleId: 'seer',
    })
  })

  it('reports teammate numbers from the selected seats', () => {
    const game = gameWith()

    expect(computeCatalogResult(game, 9, [1, 2])).toEqual({
      kind: 'teammateNumber',
      seats: [1, 2],
    })
    expect(computeCatalogResult(game, 9, [])).toEqual({
      kind: 'teammateNumber',
      seats: [],
    })
  })

  it('reports the camp of the last exiled player', () => {
    const game = gameWith([
      { type: 'elimination', seat: 3, reason: 'nightKill' },
      { type: 'elimination', seat: 4, reason: 'exile' },
      { type: 'elimination', seat: 12, reason: 'nightKill' },
    ])

    expect(lastExiledSeat(game)).toBe(4)
    expect(computeCatalogResult(game, 7, [])).toEqual({
      kind: 'lastExileCamp',
      camp: 'good',
    })
  })

  it('returns nothing when no exile has been recorded', () => {
    const game = gameWith([{ type: 'elimination', seat: 3, reason: 'nightKill' }])

    expect(lastExiledSeat(game)).toBeNull()
    expect(computeCatalogResult(game, 7, [])).toBeNull()
  })
})

describe('peekRoleStateUpdates', () => {
  function roleOf(id: string) {
    const role = getRole(id)
    if (!role) {
      throw new Error(`missing role ${id}`)
    }
    return role
  }

  it('records the seer check target and camp', () => {
    const role = roleOf('seer')

    expect(
      peekRoleStateUpdates(role, initialTrackedState(role), [1], {
        kind: 'goodOrWolf',
        camp: 'wolf',
      }),
    ).toEqual([
      { field: 'checkedSeats', value: [1] },
      { field: 'lastCheckTarget', value: 1 },
      { field: 'lastCheckCamp', value: 'wolf' },
    ])
  })

  it('merges new checked seats with the existing list', () => {
    const role = roleOf('seer')
    const current = initialTrackedState(role)
    current.checkedSeats = [2, 3]

    expect(
      peekRoleStateUpdates(role, current, [1], {
        kind: 'goodOrWolf',
        camp: 'good',
      })[0],
    ).toEqual({ field: 'checkedSeats', value: [1, 2, 3] })
  })

  it('records awakened seer pairs', () => {
    const role = roleOf('awakened-seer')

    expect(
      peekRoleStateUpdates(role, initialTrackedState(role), [1, 12], {
        kind: 'goodOrWolf',
        camp: 'wolf',
      }),
    ).toEqual([
      { field: 'checkedPairs', value: [[1, 12]] },
      { field: 'lastPair', value: [1, 12] },
      { field: 'lastPairResult', value: 'containsWolf' },
    ])
  })

  it('records exact roles for the mirror maiden', () => {
    const role = roleOf('mirror-maiden')

    expect(
      peekRoleStateUpdates(role, initialTrackedState(role), [10], {
        kind: 'exactRole',
        roleId: 'seer',
      }),
    ).toEqual([
      { field: 'checkedSeats', value: [10] },
      { field: 'lastCheckTarget', value: 10 },
      { field: 'lastCheckRole', value: 'seer' },
    ])
  })

  it('leaves non-check peeks alone', () => {
    const gravekeeper = roleOf('gravekeeper')

    expect(
      peekRoleStateUpdates(gravekeeper, initialTrackedState(gravekeeper), [4], {
        kind: 'lastExileCamp',
        camp: 'good',
      }),
    ).toEqual([])
  })
})

describe('initialPeekState', () => {
  it('starts target-based peeks on the target step', () => {
    const game = gameWith()

    expect(initialPeekState(game, 4)).toEqual({
      step: 'target',
      targetSeats: [],
      override: null,
      editing: false,
    })
    expect(initialPeekState(game, 11)).toEqual({
      step: 'target',
      targetSeats: [],
      override: null,
      editing: false,
    })
  })

  it('preselects teammate targets', () => {
    const game = gameWith()

    expect(initialPeekState(game, 8)?.targetSeats).toEqual([1])
    expect(initialPeekState(game, 9)?.targetSeats).toEqual([1, 2, 3, 6, 8, 10])
  })

  it('opens the gravekeeper preview with or without an exile', () => {
    const empty = gameWith()
    const exiled = gameWith([
      { type: 'elimination', seat: 4, reason: 'exile' },
    ])

    expect(initialPeekState(empty, 7)).toEqual({
      step: 'preview',
      targetSeats: [],
      override: { kind: 'lastExileCamp', camp: 'good' },
      editing: true,
    })
    expect(initialPeekState(exiled, 7)).toEqual({
      step: 'preview',
      targetSeats: [4],
      override: null,
      editing: false,
    })
  })

  it('returns nothing for a role without a peek ability', () => {
    expect(initialPeekState(gameWith(), 12)).toBeNull()
  })
})

describe('defaultTeammateTargets', () => {
  it('defaults the raven claw to every other wolf', () => {
    const game = gameWith()
    expect(defaultTeammateTargets(game, 9)).toEqual([1, 2, 3, 6, 8, 10])
  })

  it('defaults the scent phantom to one wolf teammate', () => {
    const game = gameWith()
    expect(defaultTeammateTargets(game, 8)).toEqual([1])
  })

  it('prefers tracked known teammates', () => {
    const raven = gameWith([
      { type: 'roleState', seat: 9, field: 'knownWolves', value: [2, 3] },
    ])
    const scent = gameWith([
      { type: 'roleState', seat: 8, field: 'knownTeammate', value: 2 },
    ])

    expect(defaultTeammateTargets(raven, 9)).toEqual([2, 3])
    expect(defaultTeammateTargets(scent, 8)).toEqual([2])
  })
})
