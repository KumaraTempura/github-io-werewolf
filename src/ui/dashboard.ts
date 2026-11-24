import {
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
  peekTargetSeats,
  type DerivedGame,
  type GameEvent,
  type PeekResult,
  type Setup,
} from '../game/state'

export interface RoleHolder {
  seat: number
  used: boolean
}

export interface RoleGroup {
  role: Role
  holders: readonly RoleHolder[]
}

const ENUM_LABELS: Readonly<Record<string, string>> = {
  good: '好人',
  wolf: '狼人',
  containsWolf: '含狼人',
  antidote: '解藥',
  poison: '毒藥',
}

const PEEK_KIND_LABELS: Readonly<Record<PeekKind, string>> = {
  none: '無查驗',
  teammateNumber: '隊友號碼',
  exactRole: '確切角色',
  goodOrWolf: '好人／狼人',
  lastExileCamp: '上次放逐陣營',
}

const EVENT_KIND_LABELS: Readonly<Record<GameEvent['type'], string>> = {
  start: '系統',
  used: '使用',
  roleState: '角色',
  tableState: '狀態',
  elimination: '出局',
  note: '備註',
  peek: '查驗',
}

export function enumLabel(value: string): string {
  return ENUM_LABELS[value] ?? getRole(value)?.name ?? value
}

export function peekKindLabel(kind: PeekKind): string {
  return PEEK_KIND_LABELS[kind]
}

export function eventKindLabel(event: GameEvent): string {
  return EVENT_KIND_LABELS[event.type]
}

export function groupRoles(game: DerivedGame): readonly RoleGroup[] {
  const order: string[] = []
  const holders = new Map<string, RoleHolder[]>()
  const { playerCount, assignments } = game.setup

  for (let seat = 1; seat <= playerCount; seat += 1) {
    const roleId = assignments[seat - 1]
    if (!roleId || !getRole(roleId)) {
      continue
    }
    if (!holders.has(roleId)) {
      order.push(roleId)
      holders.set(roleId, [])
    }
    holders.get(roleId)?.push({
      seat,
      used: game.usedBySeat[seat] ?? false,
    })
  }

  const groups: RoleGroup[] = []
  for (const roleId of order) {
    const role = getRole(roleId)
    const seats = holders.get(roleId)
    if (role && seats) {
      groups.push({ role, holders: seats })
    }
  }
  return groups
}

export function formatSeats(seats: readonly number[]): string {
  return seats.length > 0 ? `${seats.join('、')} 號` : '—'
}

function equalValues(
  a: TrackedFieldValue,
  b: TrackedFieldValue,
): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  return a === b
}

export function isInitialValue(field: TrackedField, value: TrackedFieldValue): boolean {
  return equalValues(field.initial, value)
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

export function trackedSummary(
  role: Role,
  state: TrackedState | undefined,
): readonly string[] {
  if (!state) {
    return []
  }
  const lines: string[] = []
  for (const field of role.trackedFields) {
    const value = state[field.key]
    if (value === undefined || isInitialValue(field, value)) {
      continue
    }
    lines.push(`${field.label}：${formatTrackedValue(field, value)}`)
  }
  return lines
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

export function describeEvent(event: GameEvent, setup: Setup): string {
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
      const field = role?.trackedFields.find((entry) => entry.key === event.field)
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
    case 'note':
      return event.seat === null ? event.text : `${event.seat} 號 · ${event.text}`
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
