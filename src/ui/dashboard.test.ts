import { describe, expect, it } from 'vitest'
import { getRole } from '../data/catalog'
import {
  type GameEvent,
  type Setup,
  type StartEvent,
} from '../game/state'
import {
  advancePhaseLabel,
  countActionEvents,
  cycleTabLabel,
  describeEvent,
  formatPeekResult,
  formatTrackedValue,
  hasCatalogAbility,
  isNightKillProtectionField,
  isShotField,
  logCycles,
  peekActionLabel,
  phaseLabel,
  phaseMarkerLabel,
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

describe('phase labels', () => {
  it('labels the current phase and the advance action', () => {
    expect(phaseLabel(2, 'night')).toBe('第 2 夜')
    expect(phaseLabel(2, 'daytime')).toBe('第 2 天 · 白天')
    expect(advancePhaseLabel('night')).toBe('進入白天')
    expect(advancePhaseLabel('daytime')).toBe('進入下一夜')
    expect(cycleTabLabel(2)).toBe('第 2 天')
  })

  it('labels phase markers', () => {
    expect(phaseMarkerLabel({ type: 'phase', cycle: 2, phase: 'night' })).toBe(
      '第 2 夜開始',
    )
    expect(phaseMarkerLabel({ type: 'phase', cycle: 2, phase: 'daytime' })).toBe(
      '第 2 天白天開始',
    )
  })
})

describe('peekActionLabel', () => {
  it('uses a readable action name for each peek kind', () => {
    expect(peekActionLabel('exactRole')).toBe('查驗')
    expect(peekActionLabel('goodOrWolf')).toBe('查驗')
    expect(peekActionLabel('teammateNumber')).toBe('查看隊友')
    expect(peekActionLabel('lastExileCamp')).toBe('查看上次放逐')
  })
})

describe('isNightKillProtectionField', () => {
  it('recognizes the current-night prevention targets', () => {
    expect(isNightKillProtectionField('savedSeat')).toBe(true)
    expect(isNightKillProtectionField('snakeSavedSeat')).toBe(true)
    expect(isNightKillProtectionField('guardedSeat')).toBe(true)
    expect(isNightKillProtectionField('protectedSeat')).toBe(true)
    expect(isNightKillProtectionField('poisonedSeat')).toBe(false)
    expect(isNightKillProtectionField('lastGuardedSeat')).toBe(false)
  })
})

describe('isShotField', () => {
  it('recognizes the shot target fields', () => {
    expect(isShotField('shotTarget')).toBe(true)
    expect(isShotField('shotUsed')).toBe(false)
    expect(isShotField('guardLastTarget')).toBe(false)
  })
})

describe('hasCatalogAbility', () => {
  it('is false only for a role with no tracked fields and no peek', () => {
    const seer = getRole('seer')
    const villager = getRole('villager')
    if (!seer || !villager) {
      throw new Error('missing roles')
    }

    expect(hasCatalogAbility(seer)).toBe(true)
    expect(hasCatalogAbility(villager)).toBe(false)
  })
})

describe('logCycles', () => {
  const history: GameEvent[] = [
    START,
    { type: 'used', seat: 4, used: true },
    { type: 'phase', cycle: 1, phase: 'daytime' },
    { type: 'elimination', seat: 2, reason: 'exile' },
    { type: 'phase', cycle: 2, phase: 'night' },
    { type: 'tableState', state: 'silenced', seats: [6] },
  ]

  it('groups rows by cycle newest first with global action numbers', () => {
    const cycles = logCycles(history, 2)

    expect(cycles.map((cycle) => cycle.cycle)).toEqual([2, 1])
    expect(cycles[0].rows.map((row) => row.number)).toEqual([4, null])
    expect(cycles[0].rows.map((row) => row.phase)).toEqual(['night', 'night'])
    expect(cycles[1].rows.map((row) => row.number)).toEqual([3, null, 2, 1])
    expect(cycles[1].rows.map((row) => row.phase)).toEqual([
      'daytime',
      'daytime',
      'night',
      'night',
    ])
    expect(countActionEvents(history)).toBe(4)
  })

  it('keeps the current cycle and drops older empty cycles', () => {
    const emptyMiddle: GameEvent[] = [
      START,
      { type: 'phase', cycle: 1, phase: 'daytime' },
      { type: 'phase', cycle: 2, phase: 'night' },
      { type: 'phase', cycle: 2, phase: 'daytime' },
      { type: 'phase', cycle: 3, phase: 'night' },
    ]

    const cycles = logCycles(emptyMiddle, 3)

    expect(cycles.map((cycle) => cycle.cycle)).toEqual([3, 1])
    expect(cycles[0].rows.map((row) => row.number)).toEqual([null])
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
      describeEvent({ type: 'phase', cycle: 2, phase: 'night' }, SETUP),
    ).toBe('第 2 夜開始')
    expect(describeEvent({ type: 'revive', seat: 8 }, SETUP)).toBe(
      '8 號 平民 · 復活',
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

  it('labels fields copied from a mimicked role', () => {
    const assignments = [...SETUP.assignments]
    assignments[8] = 'awakened-hidden-wolf'

    expect(
      describeEvent(
        { type: 'roleState', seat: 9, field: 'dreamTarget', value: 3 },
        { ...SETUP, assignments },
        { 9: { mimickedRole: 'dream-weaver', mimicTarget: 2 } },
      ),
    ).toBe('9 號 覺醒隱狼 · 本夜夢遊者：3 號')
  })
})
