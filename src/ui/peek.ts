import { getRole, rolesById, type PeekKind, type Role } from '../data/catalog'
import type { DerivedGame, PeekCamp, PeekResult } from '../game/state'

export type PeekTargetMode =
  | 'single'
  | 'pair'
  | 'teammates'
  | 'lastExile'
  | 'custom'

export interface PeekPlan {
  mode: PeekTargetMode
  peekKind: PeekKind
  targetCount: number
}

export interface PeekStart {
  step: 'target' | 'preview'
  targetSeats: number[]
  override: PeekResult | null
  editing: boolean
}

export function planPeek(role: Role | null): PeekPlan {
  if (!role) {
    return { mode: 'custom', peekKind: 'none', targetCount: 1 }
  }
  switch (role.peekKind) {
    case 'none':
      return { mode: 'custom', peekKind: 'none', targetCount: 1 }
    case 'exactRole':
      return { mode: 'single', peekKind: role.peekKind, targetCount: 1 }
    case 'goodOrWolf':
      return {
        mode: role.peekCount >= 2 ? 'pair' : 'single',
        peekKind: role.peekKind,
        targetCount: Math.max(1, role.peekCount),
      }
    case 'teammateNumber':
      return { mode: 'teammates', peekKind: role.peekKind, targetCount: 0 }
    case 'lastExileCamp':
      return { mode: 'lastExile', peekKind: role.peekKind, targetCount: 1 }
  }
}

export function campForRole(role: Role | undefined): PeekCamp {
  return role?.campKey === 'wolf' ? 'wolf' : 'good'
}

export function campForSeat(game: DerivedGame, seat: number): PeekCamp {
  return campForRole(getRole(game.seatRoles[seat] ?? ''))
}

export function exactRoleResultFor(
  game: DerivedGame,
  seat: number,
): PeekResult | null {
  const roleId = game.seatRoles[seat]
  return roleId ? { kind: 'exactRole', roleId } : null
}

export function exactRoleFor(
  game: DerivedGame,
  inspectorSeat: number,
  targetSeat: number,
): string | null {
  const targetRoleId = game.seatRoles[targetSeat]
  if (!targetRoleId) {
    return null
  }
  const inspectorRoleId = game.seatRoles[inspectorSeat]
  if (inspectorRoleId !== 'mirror-maiden' || targetRoleId !== 'awakened-hidden-wolf') {
    return targetRoleId
  }
  const mimicked = game.roleStateBySeat[targetSeat]?.mimickedRole
  return typeof mimicked === 'string' && rolesById.has(mimicked)
    ? mimicked
    : targetRoleId
}

export function lastExiledSeat(game: DerivedGame): number | null {
  for (let index = game.outPlayers.length - 1; index >= 0; index -= 1) {
    const player = game.outPlayers[index]
    if (player.reason === 'exile') {
      return player.seat
    }
  }
  return null
}

export function wolfTeammates(game: DerivedGame, inspectorSeat: number): number[] {
  const seats: number[] = []
  for (let seat = 1; seat <= game.setup.playerCount; seat += 1) {
    if (seat === inspectorSeat) {
      continue
    }
    if (campForSeat(game, seat) === 'wolf') {
      seats.push(seat)
    }
  }
  return seats
}

function inGame(game: DerivedGame, seats: readonly number[]): number[] {
  return seats.filter(
    (seat) =>
      Number.isInteger(seat) && seat >= 1 && seat <= game.setup.playerCount,
  )
}

export function defaultTeammateTargets(
  game: DerivedGame,
  inspectorSeat: number,
): number[] {
  const roleId = game.seatRoles[inspectorSeat]
  const state = game.roleStateBySeat[inspectorSeat]
  if (roleId === 'raven-claw') {
    const known = state?.knownWolves
    if (Array.isArray(known) && known.length > 0) {
      const seats = inGame(
        game,
        known.filter((seat): seat is number => typeof seat === 'number'),
      )
      if (seats.length > 0) {
        return seats
      }
    }
    return wolfTeammates(game, inspectorSeat)
  }
  if (roleId === 'scent-phantom') {
    const known = state?.knownTeammate
    if (typeof known === 'number' && inGame(game, [known]).length > 0) {
      return [known]
    }
    return wolfTeammates(game, inspectorSeat).slice(0, 1)
  }
  return wolfTeammates(game, inspectorSeat)
}

export function computeCatalogResult(
  game: DerivedGame,
  inspectorSeat: number,
  targetSeats: readonly number[],
): PeekResult | null {
  const role = getRole(game.seatRoles[inspectorSeat] ?? '')
  if (!role) {
    return null
  }
  switch (role.peekKind) {
    case 'none':
      return null
    case 'exactRole': {
      const targetSeat = targetSeats[0]
      if (targetSeat === undefined) {
        return null
      }
      const roleId = exactRoleFor(game, inspectorSeat, targetSeat)
      return roleId ? { kind: 'exactRole', roleId } : null
    }
    case 'goodOrWolf': {
      if (targetSeats.length === 0) {
        return null
      }
      const camp = targetSeats.some((seat) => campForSeat(game, seat) === 'wolf')
        ? 'wolf'
        : 'good'
      return { kind: 'goodOrWolf', camp }
    }
    case 'teammateNumber':
      return { kind: 'teammateNumber', seats: [...targetSeats] }
    case 'lastExileCamp': {
      const seat = lastExiledSeat(game)
      if (seat === null) {
        return null
      }
      return { kind: 'lastExileCamp', camp: campForSeat(game, seat) }
    }
  }
}

export function initialPeekState(
  game: DerivedGame,
  inspectorSeat: number,
): PeekStart | null {
  const role = getRole(game.seatRoles[inspectorSeat] ?? '')
  if (!role || role.peekKind === 'none') {
    return null
  }
  const plan = planPeek(role)
  if (plan.mode === 'lastExile') {
    const exiled = lastExiledSeat(game)
    const targetSeats = exiled !== null ? [exiled] : []
    return computeCatalogResult(game, inspectorSeat, [])
      ? { step: 'preview', targetSeats, override: null, editing: false }
      : {
          step: 'preview',
          targetSeats,
          override: { kind: 'lastExileCamp', camp: 'good' },
          editing: true,
        }
  }
  if (plan.mode === 'teammates') {
    return {
      step: 'target',
      targetSeats: defaultTeammateTargets(game, inspectorSeat),
      override: null,
      editing: false,
    }
  }
  return { step: 'target', targetSeats: [], override: null, editing: false }
}

export function hasEnoughTargets(plan: PeekPlan, count: number): boolean {
  switch (plan.mode) {
    case 'single':
    case 'custom':
      return count === 1
    case 'pair':
      return count === 2
    case 'teammates':
    case 'lastExile':
      return true
  }
}
