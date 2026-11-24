import catalogJson from './role-catalog.json'

export type CampKey = 'wolf' | 'god' | 'villager' | 'special'

export interface Role {
  id: string
  name: string
  camp: string
  campKey: CampKey
}

interface PresetRoleCount {
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

interface CatalogMeta {
  roleCount: number
  presetCount: number
}

interface RoleCatalog {
  meta: CatalogMeta
  roles: readonly Role[]
  presets: readonly PresetBoard[]
}

const CAMP_KEYS: readonly string[] = ['wolf', 'god', 'villager', 'special']

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

  for (const key of ['name', 'camp'] as const) {
    if (!isNonEmptyString(value[key])) {
      issues.push(`${path}.${key}: expected a non-empty string`)
    }
  }

  if (!isOneOf(value.campKey, CAMP_KEYS)) {
    issues.push(`${path}.campKey: expected one of ${CAMP_KEYS.join(', ')}`)
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

const catalog: RoleCatalog = catalogJson as unknown as RoleCatalog
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

export function expandPreset(board: PresetBoard): string[] {
  const assignments: string[] = []
  for (const entry of board.roles) {
    for (let index = 0; index < entry.count; index += 1) {
      assignments.push(entry.roleId)
    }
  }
  return assignments
}
