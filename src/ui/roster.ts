import {
  presetBoards,
  roles,
  rolesById,
  type CampKey,
  type PresetBoard,
  type Role,
} from '../data/catalog'

export const CUSTOM_BOARD_ID = 'custom'
export const MIN_PLAYERS = 7
export const MAX_PLAYERS = 12

export const CAMP_GROUPS: readonly { key: CampKey; label: string }[] = [
  { key: 'wolf', label: '狼人陣營' },
  { key: 'god', label: '好人陣營 · 神職' },
  { key: 'villager', label: '好人陣營 · 平民' },
  { key: 'special', label: '特殊陣營' },
]

export function expandPreset(board: PresetBoard): string[] {
  const assignments: string[] = []
  for (const entry of board.roles) {
    for (let index = 0; index < entry.count; index += 1) {
      assignments.push(entry.roleId)
    }
  }
  return assignments
}

export function assignmentsComplete(
  assignments: readonly (string | null)[],
  playerCount: number,
): boolean {
  return (
    playerCount > 0 &&
    assignments.length === playerCount &&
    assignments.every((roleId) => roleId !== null)
  )
}

export function shuffleAssignments(assignments: readonly string[]): string[] {
  const shuffled = [...assignments]
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1))
    const value = shuffled[index]
    shuffled[index] = shuffled[swap]
    shuffled[swap] = value
  }
  return shuffled
}

export interface RoleCount {
  role: Role
  count: number
}

export function roleCounts(
  assignments: readonly (string | null)[],
): readonly RoleCount[] {
  const counts = new Map<string, number>()
  for (const roleId of assignments) {
    if (roleId !== null) {
      counts.set(roleId, (counts.get(roleId) ?? 0) + 1)
    }
  }
  const result: RoleCount[] = []
  for (const [roleId, count] of counts) {
    const role = rolesById.get(roleId)
    if (role) {
      result.push({ role, count })
    }
  }
  return result
}

export function presetSections(): readonly {
  section: string
  boards: readonly PresetBoard[]
}[] {
  const sections = new Map<string, PresetBoard[]>()
  for (const board of presetBoards) {
    const boards = sections.get(board.section) ?? []
    boards.push(board)
    sections.set(board.section, boards)
  }
  return [...sections.entries()].map(([section, boards]) => ({
    section,
    boards,
  }))
}

export function rolesForCamp(camp: CampKey): readonly Role[] {
  return roles.filter((role) => role.campKey === camp)
}
