import { describe, expect, it } from 'vitest'
import catalogJson from './role-catalog.json'
import {
  getPresetBoard,
  getRole,
  presetBoards,
  roles,
  validateCatalog,
} from './catalog'

function cloneCatalog(): any {
  return JSON.parse(JSON.stringify(catalogJson))
}

describe('role catalog', () => {
  it('passes schema validation', () => {
    expect(validateCatalog(catalogJson)).toEqual([])
  })

  it('contains every researched role and preset board', () => {
    expect(roles).toHaveLength(40)
    expect(presetBoards).toHaveLength(36)
    expect(new Set(roles.map((role) => role.id)).size).toBe(roles.length)
    expect(new Set(presetBoards.map((board) => board.id)).size).toBe(
      presetBoards.length,
    )
  })

  it('sums every preset composition to its player count with known roles', () => {
    for (const board of presetBoards) {
      const total = board.roles.reduce((sum, entry) => sum + entry.count, 0)
      expect(total, board.id).toBe(board.playerCount)

      for (const entry of board.roles) {
        expect(getRole(entry.roleId), `${board.id}: ${entry.roleId}`).toBeDefined()
      }
    }
  })

  it('exposes role name, camp, and camp key', () => {
    expect(getRole('wolf')).toMatchObject({
      name: '狼人',
      camp: '狼人陣營',
      campKey: 'wolf',
    })
    expect(getRole('seer')).toMatchObject({
      name: '預言家',
      camp: '好人陣營/神職',
      campKey: 'god',
    })
    expect(getRole('hidden-wolf')).toMatchObject({
      name: '隱狼',
      campKey: 'wolf',
    })
  })

  it('looks up roles and presets by id', () => {
    expect(getRole('missing-role')).toBeUndefined()
    expect(getPresetBoard('missing-board')).toBeUndefined()
    expect(getPresetBoard('standard-333')).toMatchObject({
      section: '2.1',
      name: '標準 333',
      playerCount: 9,
      roles: [
        { roleId: 'wolf', count: 3 },
        { roleId: 'seer', count: 1 },
        { roleId: 'witch', count: 1 },
        { roleId: 'hunter', count: 1 },
        { roleId: 'villager', count: 3 },
      ],
    })
  })

  it('includes the catalog-only roles in no preset board', () => {
    for (const roleId of ['bear-tamer', 'hidden-wolf']) {
      const inPresets = presetBoards.some((board) =>
        board.roles.some((entry) => entry.roleId === roleId),
      )
      expect(inPresets, roleId).toBe(false)
    }
  })
})

describe('catalog validation', () => {
  it('rejects a preset whose composition does not sum to its player count', () => {
    const raw = cloneCatalog()
    raw.presets[0].roles[0].count += 1

    expect(validateCatalog(raw).join('\n')).toContain(
      'counts sum to 10, expected playerCount 9',
    )
  })

  it('rejects a preset that references an unknown role', () => {
    const raw = cloneCatalog()
    raw.presets[0].roles[0].roleId = 'not-a-role'

    expect(validateCatalog(raw).join('\n')).toContain(
      'unknown role "not-a-role"',
    )
  })

  it('rejects a role missing a required schema field', () => {
    const raw = cloneCatalog()
    delete raw.roles[0].name

    expect(validateCatalog(raw).join('\n')).toContain(
      'roles[0].name: expected a non-empty string',
    )
  })

  it('rejects duplicate role ids', () => {
    const raw = cloneCatalog()
    raw.roles[1].id = raw.roles[0].id

    expect(validateCatalog(raw).join('\n')).toContain('duplicate role id')
  })
})
