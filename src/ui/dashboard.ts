import {
  findEffectiveTrackedField,
  getRole,
  type PeekKind,
  type Role,
  type TrackedField,
  type TrackedFieldValue,
  type TrackedState,
} from '../data/catalog'
import {
  ELIMINATION_REASON_LABELS,
  TABLE_STATE_LABELS,
  initialPhase,
  peekTargetSeats,
  type GameEvent,
  type PeekResult,
  type Phase,
  type PhaseEvent,
  type Setup,
} from '../game/state'

const ENUM_LABELS: Readonly<Record<string, string>> = {
  good: '好人',
  wolf: '狼人',
  containsWolf: '含狼人',
  antidote: '解藥',
  poison: '毒藥',
}

type PeekActionKind = Exclude<PeekKind, 'none'>

const PEEK_ACTION_LABELS: Readonly<Record<PeekActionKind, string>> = {
  teammateNumber: '查看隊友',
  exactRole: '查驗',
  goodOrWolf: '查驗',
  lastExileCamp: '查看上次放逐',
}

const EVENT_KIND_LABELS: Readonly<Record<GameEvent['type'], string>> = {
  start: '系統',
  used: '使用',
  roleState: '角色',
  tableState: '狀態',
  elimination: '出局',
  note: '備註',
  phase: '階段',
  revive: '復活',
  peek: '查驗',
}

export function enumLabel(value: string): string {
  return ENUM_LABELS[value] ?? getRole(value)?.name ?? value
}

export function peekActionLabel(kind: PeekActionKind): string {
  return PEEK_ACTION_LABELS[kind]
}

export function hasCatalogAbility(role: Role): boolean {
  return role.trackedFields.length > 0 || role.peekKind !== 'none'
}

const NIGHT_KILL_PROTECTION_FIELDS = new Set([
  'savedSeat',
  'snakeSavedSeat',
  'guardedSeat',
  'protectedSeat',
])

export function isNightKillProtectionField(fieldKey: string): boolean {
  return NIGHT_KILL_PROTECTION_FIELDS.has(fieldKey)
}

const SHOT_FIELD_KEYS = new Set(['shotTarget'])

export function isShotField(fieldKey: string): boolean {
  return SHOT_FIELD_KEYS.has(fieldKey)
}

export function phaseLabel(cycle: number, phase: Phase): string {
  return phase === 'night' ? `第 ${cycle} 夜` : `第 ${cycle} 天 · 白天`
}

export function advancePhaseLabel(phase: Phase): string {
  return phase === 'night' ? '進入白天' : '進入下一夜'
}

export function cycleTabLabel(cycle: number): string {
  return `第 ${cycle} 天`
}

export function phaseMarkerLabel(event: PhaseEvent): string {
  return event.phase === 'night'
    ? `第 ${event.cycle} 夜開始`
    : `第 ${event.cycle} 天白天開始`
}

export interface LogRow {
  event: GameEvent
  number: number | null
  phase: Phase
}

export interface LogCycle {
  cycle: number
  rows: readonly LogRow[]
}

export function isPhaseEvent(event: GameEvent): event is PhaseEvent {
  return event.type === 'phase'
}

export function countActionEvents(history: readonly GameEvent[]): number {
  return history.reduce(
    (count, event) => count + (isPhaseEvent(event) ? 0 : 1),
    0,
  )
}

export function logCycles(
  history: readonly GameEvent[],
  currentCycle: number,
): readonly LogCycle[] {
  const rowsByCycle = new Map<number, LogRow[]>()
  const start = initialPhase()
  let cycle = start.cycle
  let phase = start.phase
  let number = 0

  for (const event of history) {
    if (isPhaseEvent(event)) {
      cycle = event.cycle
      phase = event.phase
    } else {
      number += 1
    }
    const rows = rowsByCycle.get(cycle) ?? []
    rows.push({
      event,
      number: isPhaseEvent(event) ? null : number,
      phase,
    })
    rowsByCycle.set(cycle, rows)
  }

  const cycles: LogCycle[] = []
  for (const [cycleNumber, rows] of rowsByCycle) {
    const actionCount = rows.reduce(
      (count, row) => count + (row.number === null ? 0 : 1),
      0,
    )
    if (actionCount === 0 && cycleNumber !== currentCycle) {
      continue
    }
    cycles.push({
      cycle: cycleNumber,
      rows: [...rows].reverse(),
    })
  }

  return cycles.sort((a, b) => b.cycle - a.cycle)
}

export function eventKindLabel(event: GameEvent): string {
  return EVENT_KIND_LABELS[event.type]
}

export function formatSeats(seats: readonly number[]): string {
  return seats.length > 0 ? `${seats.join('、')} 號` : '—'
}

export function formatTrackedValue(
  field: TrackedField,
  value: TrackedFieldValue,
): string {
  switch (field.type) {
    case 'seat':
      return typeof value === 'number' ? `${value} 號` : '—'
    case 'boolean':
      return value === true ? '是' : '否'
    case 'seatList':
      return Array.isArray(value)
        ? formatSeats(value.filter((entry): entry is number => typeof entry === 'number'))
        : '—'
    case 'roleId':
      return typeof value === 'string' ? getRole(value)?.name ?? value : '—'
    case 'counter':
      return typeof value === 'number' ? String(value) : '—'
    case 'enum':
      return typeof value === 'string' ? enumLabel(value) : '—'
    case 'seatPairList':
      return Array.isArray(value) && value.length > 0
        ? value
            .map((pair) =>
              Array.isArray(pair) && pair.length === 2
                ? `${pair[0]}-${pair[1]}`
                : String(pair),
            )
            .join('、')
        : '—'
  }
}

export function formatPeekResult(result: PeekResult): string {
  switch (result.kind) {
    case 'exactRole':
      return getRole(result.roleId)?.name ?? result.roleId
    case 'goodOrWolf':
      return enumLabel(result.camp)
    case 'teammateNumber':
      return result.seats.length > 0
        ? `隊友 ${result.seats.join('、')} 號`
        : '沒有隊友'
    case 'lastExileCamp':
      return `上次放逐：${enumLabel(result.camp)}`
  }
}

function seatRoleName(setup: Setup, seat: number): string {
  const roleId = setup.assignments[seat - 1]
  return roleId ? getRole(roleId)?.name ?? roleId : '—'
}

export function describeEvent(
  event: GameEvent,
  setup: Setup,
  roleStateBySeat?: Readonly<Record<number, TrackedState>>,
): string {
  switch (event.type) {
    case 'start':
      return `開始遊戲 · ${
        event.setup.mode === 'digital' ? '數位發牌' : '實體發牌'
      } · ${event.setup.playerCount} 人`
    case 'used':
      return `${event.seat} 號 ${seatRoleName(setup, event.seat)} · ${
        event.used ? '標記為已使用' : '取消已使用'
      }`
    case 'roleState': {
      const role = getRole(setup.assignments[event.seat - 1] ?? '')
      const field = findEffectiveTrackedField(
        role,
        roleStateBySeat?.[event.seat],
        event.field,
      )
      const label = field?.label ?? event.field
      const value = field
        ? formatTrackedValue(field, event.value)
        : String(event.value)
      return `${event.seat} 號 ${seatRoleName(setup, event.seat)} · ${label}：${value}`
    }
    case 'tableState':
      return event.seats.length > 0
        ? `${TABLE_STATE_LABELS[event.state]}：${formatSeats(event.seats)}`
        : `移除「${TABLE_STATE_LABELS[event.state]}」`
    case 'elimination':
      return `${event.seat} 號 ${seatRoleName(setup, event.seat)} 出局（${
        ELIMINATION_REASON_LABELS[event.reason]
      }）`
    case 'revive':
      return `${event.seat} 號 ${seatRoleName(setup, event.seat)} · 復活`
    case 'note':
      return event.seat === null ? event.text : `${event.seat} 號 · ${event.text}`
    case 'phase':
      return phaseMarkerLabel(event)
    case 'peek': {
      const inspector = seatRoleName(setup, event.inspectorSeat)
      if (
        event.result.kind === 'teammateNumber' ||
        event.result.kind === 'lastExileCamp'
      ) {
        return `${inspector}查驗 · ${formatPeekResult(event.result)}`
      }
      const targets = peekTargetSeats(event).join('、')
      return `${inspector}查驗 ${targets} 號 · ${formatPeekResult(event.result)}`
    }
  }
}
