import { describe, expect, it } from 'vitest'
import { getRole, initialTrackedState } from '../data/catalog'
import { deriveGame, type Setup, type StartEvent } from '../game/state'
import {
  describeEvent,
  formatPeekResult,
  formatTrackedValue,
  groupRoles,
  trackedSummary,
} from './dashboard'

const SETUP: Setup = {
  boardId: 'standard-333',
  playerCount: 9,
  mode: 'physical',
  assignments: [
    'wolf',
    'wolf',
    'wolf',
    'seer',
    'witch',
    'hunter',
    'villager',
    'villager',
    'villager',
  ],
}

const START: StartEvent = { type: 'start', setup: SETUP }

function derived() {
  const game = deriveGame([START])
  if (!game) {
    throw new Error('expected a derived game')
  }
  return game
}

describe('groupRoles', () => {
  it('groups holders by role in seat order', () => {
    const groups = groupRoles(derived())
    expect(groups.map((group) => group.role.id)).toEqual([
      'wolf',
      'seer',
      'witch',
      'hunter',
      'villager',
    ])
    expect(groups[0].holders.map((holder) => holder.seat)).toEqual([1, 2, 3])
    expect(groups[4].holders).toHaveLength(3)
  })
})

describe('trackedSummary', () => {
  it('lists only values changed from their initial state', () => {
    const seer = getRole('seer')
    if (!seer) {
      throw new Error('missing seer')
    }
    const state = initialTrackedState(seer)
    state.checkedSeats = [5, 7]
    state.lastCheckCamp = 'wolf'

    expect(trackedSummary(seer, state)).toEqual([
      '已查驗座位：5、7 號',
      '最近查驗陣營：狼人',
    ])
    expect(trackedSummary(seer, initialTrackedState(seer))).toEqual([])
  })
})

describe('formatTrackedValue', () => {
  it('formats every tracked field type', () => {
    const awakenedSeer = getRole('awakened-seer')
    const wolf = getRole('awakened-hidden-wolf')
    const witch = getRole('witch')
    if (!awakenedSeer || !wolf || !witch) {
      throw new Error('missing roles')
    }
    const pairs = awakenedSeer.trackedFields.find(
      (field) => field.type === 'seatPairList',
    )
    const mimicked = wolf.trackedFields.find((field) => field.type === 'roleId')
    const antidote = witch.trackedFields.find(
      (field) => field.key === 'antidoteRemaining',
    )
    if (!pairs || !mimicked || !antidote) {
      throw new Error('missing fields')
    }

    expect(formatTrackedValue(pairs, [[1, 2], [3, 4]])).toBe('1-2、3-4')
    expect(formatTrackedValue(mimicked, 'seer')).toBe('預言家')
    expect(formatTrackedValue(antidote, 0)).toBe('0')
    expect(formatTrackedValue(antidote, 1)).toBe('1')
  })
})

describe('formatPeekResult', () => {
  it('formats each peek result kind', () => {
    expect(formatPeekResult({ kind: 'exactRole', roleId: 'seer' })).toBe('預言家')
    expect(formatPeekResult({ kind: 'goodOrWolf', camp: 'wolf' })).toBe('狼人')
    expect(formatPeekResult({ kind: 'teammateNumber', seats: [2, 3] })).toBe(
      '隊友 2、3 號',
    )
    expect(formatPeekResult({ kind: 'teammateNumber', seats: [] })).toBe('沒有隊友')
    expect(formatPeekResult({ kind: 'lastExileCamp', camp: 'good' })).toBe(
      '上次放逐：好人',
    )
  })
})

describe('describeEvent', () => {
  it('describes each event type', () => {
    expect(describeEvent(START, SETUP)).toBe('開始遊戲 · 實體發牌 · 9 人')
    expect(
      describeEvent({ type: 'used', seat: 4, used: true }, SETUP),
    ).toBe('4 號 預言家 · 標記為已使用')
    expect(
      describeEvent(
        {
          type: 'roleState',
          seat: 4,
          field: 'lastCheckCamp',
          value: 'wolf',
        },
        SETUP,
      ),
    ).toBe('4 號 預言家 · 最近查驗陣營：狼人')
    expect(
      describeEvent({ type: 'tableState', state: 'silenced', seats: [2, 6] }, SETUP),
    ).toBe('禁言：2、6 號')
    expect(
      describeEvent({ type: 'tableState', state: 'badge', seats: [] }, SETUP),
    ).toBe('移除「警長」')
    expect(
      describeEvent({ type: 'elimination', seat: 8, reason: 'exile' }, SETUP),
    ).toBe('8 號 平民 出局（放逐）')
    expect(describeEvent({ type: 'note', seat: null, text: '天黑' }, SETUP)).toBe(
      '天黑',
    )
    expect(describeEvent({ type: 'note', seat: 3, text: '狼刀' }, SETUP)).toBe(
      '3 號 · 狼刀',
    )
    expect(
      describeEvent(
        {
          type: 'peek',
          inspectorSeat: 4,
          targetSeat: 2,
          result: { kind: 'goodOrWolf', camp: 'wolf' },
        },
        SETUP,
      ),
    ).toBe('預言家查驗 2 號 · 狼人')
  })
})
