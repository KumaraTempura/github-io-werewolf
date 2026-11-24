import catalogJson from './role-catalog.json'

export type CampKey = 'wolf' | 'god' | 'villager' | 'special'

export type PeekKind =
  | 'none'
  | 'teammateNumber'
  | 'exactRole'
  | 'goodOrWolf'
  | 'lastExileCamp'

export type NightAction =
  | 'everyNight'
  | 'firstNightOnly'
  | 'conditional'
  | 'secondNightOnward'
  | 'none'

export type WolfDiscussion =
  | 'joins'
  | 'conditional'
  | 'separate'
  | 'unclear'
  | 'none'

export interface WakeOrder {
  firstNight: number | null
  laterNight: number | null
  firstNightSecondAction: number | null
  laterNightSecondAction: number | null
}

interface TrackedFieldBase {
  key: string
  label: string
}

export interface SeatTrackedField extends TrackedFieldBase {
  type: 'seat'
  initial: number | null
}

export interface BooleanTrackedField extends TrackedFieldBase {
  type: 'boolean'
  initial: boolean
}

export interface SeatListTrackedField extends TrackedFieldBase {
  type: 'seatList'
  initial: number[]
}

export interface RoleIdTrackedField extends TrackedFieldBase {
  type: 'roleId'
  initial: string | null
}

export interface CounterTrackedField extends TrackedFieldBase {
  type: 'counter'
  initial: number
  min: number
  max: number
}

export interface EnumTrackedField extends TrackedFieldBase {
  type: 'enum'
  values: string[]
  initial: string | null
}

export interface SeatPairListTrackedField extends TrackedFieldBase {
  type: 'seatPairList'
  initial: [number, number][]
}

export type TrackedField =
  | SeatTrackedField
  | BooleanTrackedField
  | SeatListTrackedField
  | RoleIdTrackedField
  | CounterTrackedField
  | EnumTrackedField
  | SeatPairListTrackedField

export type TrackedFieldValue =
  | number
  | boolean
  | string
  | number[]
  | [number, number][]
  | null

export type TrackedState = Record<string, TrackedFieldValue>

export interface Role {
  id: string
  name: string
  camp: string
  campKey: CampKey
  ability: string
  trackedFields: readonly TrackedField[]
  peekKind: PeekKind
  peekCount: number
  peekNote: string | null
  firstNightOnly: boolean
  nightAction: NightAction
  wolfDiscussion: WolfDiscussion
  wakeOrder: WakeOrder
  sourcePage: number
  notes: string | null
}

export interface PresetRoleCount {
  roleId: string
  count: number
}

export interface PresetBoard {
  id: string
  section: string
  name: string
  playerCount: number
  roles: readonly PresetRoleCount[]
  sourcePage: number
  notes?: string | null
}

export interface NonRoleWakeEntry {
  name: string
  firstNight: number | null
  laterNight: number | null
  note: string
}

export interface CatalogMeta {
  sourcePdf: string
  sourceOcr: string
  language: string
  roleCount: number
  presetCount: number
  roleSourcePages: string
  presetSourcePages: string
  wakeOrderSourcePages: readonly number[]
  nonRoleWakeEntries: readonly NonRoleWakeEntry[]
  notes: readonly string[]
}

export interface RoleCatalog {
  meta: CatalogMeta
  roles: readonly Role[]
  presets: readonly PresetBoard[]
}

const CAMP_KEYS: readonly string[] = ['wolf', 'god', 'villager', 'special']
const PEEK_KINDS: readonly string[] = [
  'none',
  'teammateNumber',
  'exactRole',
  'goodOrWolf',
  'lastExileCamp',
]
const NIGHT_ACTIONS: readonly string[] = [
  'everyNight',
  'firstNightOnly',
  'conditional',
  'secondNightOnward',
  'none',
]
const WOLF_DISCUSSIONS: readonly string[] = [
  'joins',
  'conditional',
  'separate',
  'unclear',
  'none',
]
const TRACKED_FIELD_TYPES: readonly string[] = [
  'seat',
  'boolean',
  'seatList',
  'roleId',
  'counter',
  'enum',
  'seatPairList',
]
const WAKE_ORDER_KEYS = [
  'firstNight',
  'laterNight',
  'firstNightSecondAction',
  'laterNightSecondAction',
] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function isPositiveInteger(value: unknown): value is number {
  return isInteger(value) && value > 0
}

function isOneOf(value: unknown, options: readonly string[]): value is string {
  return typeof value === 'string' && options.includes(value)
}

function validateTrackedField(
  value: unknown,
  path: string,
  keys: Set<string>,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return
  }

  const key = value.key
  if (!isNonEmptyString(key)) {
    issues.push(`${path}.key: expected a non-empty string`)
  } else if (keys.has(key)) {
    issues.push(`${path}.key: duplicate tracked field key "${key}"`)
  } else {
    keys.add(key)
  }

  if (!isNonEmptyString(value.label)) {
    issues.push(`${path}.label: expected a non-empty string`)
  }

  if (!isOneOf(value.type, TRACKED_FIELD_TYPES)) {
    issues.push(`${path}.type: expected one of ${TRACKED_FIELD_TYPES.join(', ')}`)
    return
  }

  switch (value.type) {
    case 'seat':
      if (value.initial !== null && !isPositiveInteger(value.initial)) {
        issues.push(`${path}.initial: expected null or a seat number`)
      }
      break
    case 'boolean':
      if (typeof value.initial !== 'boolean') {
        issues.push(`${path}.initial: expected a boolean`)
      }
      break
    case 'seatList':
      if (!Array.isArray(value.initial) || !value.initial.every(isPositiveInteger)) {
        issues.push(`${path}.initial: expected an array of seat numbers`)
      }
      break
    case 'roleId':
      if (value.initial !== null && !isNonEmptyString(value.initial)) {
        issues.push(`${path}.initial: expected null or a role id`)
      }
      break
    case 'counter': {
      const initial = value.initial
      const min = value.min
      const max = value.max
      if (!isInteger(initial)) {
        issues.push(`${path}.initial: expected an integer`)
      }
      if (!isInteger(min)) {
        issues.push(`${path}.min: expected an integer`)
      }
      if (!isInteger(max)) {
        issues.push(`${path}.max: expected an integer`)
      }
      if (isInteger(initial) && isInteger(min) && isInteger(max)) {
        if (min > max) {
          issues.push(`${path}: min must not exceed max`)
        }
        if (initial < min || initial > max) {
          issues.push(`${path}: initial must be within min and max`)
        }
      }
      break
    }
    case 'enum': {
      const values = value.values
      const initial = value.initial
      if (!Array.isArray(values) || values.length === 0) {
        issues.push(`${path}.values: expected a non-empty array`)
      } else {
        if (!values.every(isNonEmptyString)) {
          issues.push(`${path}.values: expected non-empty strings`)
        }
        if (new Set(values).size !== values.length) {
          issues.push(`${path}.values: expected unique values`)
        }
      }
      if (
        initial !== null &&
        (typeof initial !== 'string' ||
          (Array.isArray(values) && !values.includes(initial)))
      ) {
        issues.push(`${path}.initial: expected null or one of the declared values`)
      }
      break
    }
    case 'seatPairList':
      if (
        !Array.isArray(value.initial) ||
        !value.initial.every(
          (pair) =>
            Array.isArray(pair) && pair.length === 2 && pair.every(isPositiveInteger),
        )
      ) {
        issues.push(`${path}.initial: expected an array of seat pairs`)
      }
      break
  }
}

function validateRole(
  value: unknown,
  path: string,
  roleIds: Set<string>,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return
  }

  const id = value.id
  if (!isNonEmptyString(id)) {
    issues.push(`${path}.id: expected a non-empty string`)
  } else if (roleIds.has(id)) {
    issues.push(`${path}.id: duplicate role id "${id}"`)
  } else {
    roleIds.add(id)
  }

  for (const key of ['name', 'camp', 'ability'] as const) {
    if (!isNonEmptyString(value[key])) {
      issues.push(`${path}.${key}: expected a non-empty string`)
    }
  }

  if (!isOneOf(value.campKey, CAMP_KEYS)) {
    issues.push(`${path}.campKey: expected one of ${CAMP_KEYS.join(', ')}`)
  }
  if (!isOneOf(value.peekKind, PEEK_KINDS)) {
    issues.push(`${path}.peekKind: expected one of ${PEEK_KINDS.join(', ')}`)
  }
  if (!isInteger(value.peekCount) || value.peekCount < 0) {
    issues.push(`${path}.peekCount: expected a non-negative integer`)
  }
  if (value.peekNote !== null && typeof value.peekNote !== 'string') {
    issues.push(`${path}.peekNote: expected null or a string`)
  }
  if (typeof value.firstNightOnly !== 'boolean') {
    issues.push(`${path}.firstNightOnly: expected a boolean`)
  }
  if (!isOneOf(value.nightAction, NIGHT_ACTIONS)) {
    issues.push(`${path}.nightAction: expected one of ${NIGHT_ACTIONS.join(', ')}`)
  }
  if (!isOneOf(value.wolfDiscussion, WOLF_DISCUSSIONS)) {
    issues.push(`${path}.wolfDiscussion: expected one of ${WOLF_DISCUSSIONS.join(', ')}`)
  }
  if (!isPositiveInteger(value.sourcePage)) {
    issues.push(`${path}.sourcePage: expected a positive integer`)
  }
  if (value.notes !== null && typeof value.notes !== 'string') {
    issues.push(`${path}.notes: expected null or a string`)
  }

  if (!isRecord(value.wakeOrder)) {
    issues.push(`${path}.wakeOrder: expected an object`)
  } else {
    for (const key of WAKE_ORDER_KEYS) {
      const order = value.wakeOrder[key]
      if (order !== null && !isPositiveInteger(order)) {
        issues.push(`${path}.wakeOrder.${key}: expected a positive integer or null`)
      }
    }
  }

  if (!Array.isArray(value.trackedFields)) {
    issues.push(`${path}.trackedFields: expected an array`)
  } else {
    const keys = new Set<string>()
    value.trackedFields.forEach((field: unknown, index: number) => {
      validateTrackedField(field, `${path}.trackedFields[${index}]`, keys, issues)
    })
  }
}

function validatePreset(
  value: unknown,
  path: string,
  roleIds: Set<string>,
  presetIds: Set<string>,
  issues: string[],
): void {
  if (!isRecord(value)) {
    issues.push(`${path}: expected an object`)
    return
  }

  const id = value.id
  if (!isNonEmptyString(id)) {
    issues.push(`${path}.id: expected a non-empty string`)
  } else if (presetIds.has(id)) {
    issues.push(`${path}.id: duplicate preset id "${id}"`)
  } else {
    presetIds.add(id)
  }

  if (!isNonEmptyString(value.section)) {
    issues.push(`${path}.section: expected a non-empty string`)
  }
  if (!isNonEmptyString(value.name)) {
    issues.push(`${path}.name: expected a non-empty string`)
  }
  if (!isPositiveInteger(value.sourcePage)) {
    issues.push(`${path}.sourcePage: expected a positive integer`)
  }
  if (
    value.notes !== undefined &&
    value.notes !== null &&
    typeof value.notes !== 'string'
  ) {
    issues.push(`${path}.notes: expected null, a string, or absent`)
  }

  if (!isPositiveInteger(value.playerCount)) {
    issues.push(`${path}.playerCount: expected a positive integer`)
  }

  if (!Array.isArray(value.roles) || value.roles.length === 0) {
    issues.push(`${path}.roles: expected a non-empty array`)
    return
  }

  let total = 0
  const seen = new Set<string>()

  value.roles.forEach((entry: unknown, index: number) => {
    const entryPath = `${path}.roles[${index}]`
    if (!isRecord(entry)) {
      issues.push(`${entryPath}: expected an object`)
      return
    }

    const roleId = entry.roleId
    if (!isNonEmptyString(roleId)) {
      issues.push(`${entryPath}.roleId: expected a non-empty string`)
    } else {
      if (!roleIds.has(roleId)) {
        issues.push(`${entryPath}.roleId: unknown role "${roleId}"`)
      }
      if (seen.has(roleId)) {
        issues.push(`${entryPath}.roleId: duplicate role "${roleId}" in preset`)
      }
      seen.add(roleId)
    }

    const count = entry.count
    if (!isPositiveInteger(count)) {
      issues.push(`${entryPath}.count: expected a positive integer`)
    } else {
      total += count
    }
  })

  if (isPositiveInteger(value.playerCount) && total !== value.playerCount) {
    issues.push(
      `${path}.roles: counts sum to ${total}, expected playerCount ${value.playerCount}`,
    )
  }
}

export function validateCatalog(raw: unknown): string[] {
  if (!isRecord(raw)) {
    return ['catalog: expected a JSON object']
  }

  const issues: string[] = []
  const meta = raw.meta
  const rolesValue = raw.roles
  const presetsValue = raw.presets

  if (!isRecord(meta)) {
    issues.push('catalog.meta: expected an object')
  }
  if (!Array.isArray(rolesValue)) {
    issues.push('catalog.roles: expected an array')
  }
  if (!Array.isArray(presetsValue)) {
    issues.push('catalog.presets: expected an array')
  }
  if (
    !isRecord(meta) ||
    !Array.isArray(rolesValue) ||
    !Array.isArray(presetsValue)
  ) {
    return issues
  }

  if (meta.roleCount !== rolesValue.length) {
    issues.push(
      `catalog.meta.roleCount: expected ${rolesValue.length}, got ${String(meta.roleCount)}`,
    )
  }
  if (meta.presetCount !== presetsValue.length) {
    issues.push(
      `catalog.meta.presetCount: expected ${presetsValue.length}, got ${String(meta.presetCount)}`,
    )
  }

  const roleIds = new Set<string>()
  rolesValue.forEach((role: unknown, index: number) => {
    validateRole(role, `roles[${index}]`, roleIds, issues)
  })

  const presetIds = new Set<string>()
  presetsValue.forEach((preset: unknown, index: number) => {
    validatePreset(preset, `presets[${index}]`, roleIds, presetIds, issues)
  })

  return issues
}

const validationIssues = validateCatalog(catalogJson)

if (validationIssues.length > 0) {
  throw new Error(`Invalid role catalog:\n- ${validationIssues.join('\n- ')}`)
}

export const catalog: RoleCatalog = catalogJson as unknown as RoleCatalog
export const roles: readonly Role[] = catalog.roles
export const presetBoards: readonly PresetBoard[] = catalog.presets

export const rolesById: ReadonlyMap<string, Role> = new Map(
  roles.map((role) => [role.id, role]),
)

export const presetBoardsById: ReadonlyMap<string, PresetBoard> = new Map(
  presetBoards.map((board) => [board.id, board]),
)

export function getRole(roleId: string): Role | undefined {
  return rolesById.get(roleId)
}

export function getPresetBoard(presetId: string): PresetBoard | undefined {
  return presetBoardsById.get(presetId)
}

function cloneInitialValue(value: TrackedFieldValue): TrackedFieldValue {
  if (!Array.isArray(value)) {
    return value
  }
  return value.map((entry) =>
    Array.isArray(entry) ? [...entry] : entry,
  ) as TrackedFieldValue
}

export function initialTrackedState(role: Role): TrackedState {
  const state: TrackedState = {}
  for (const field of role.trackedFields) {
    state[field.key] = cloneInitialValue(field.initial)
  }
  return state
}
