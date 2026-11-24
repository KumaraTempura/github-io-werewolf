import { expandPreset, presetBoardsById, rolesById } from '../data/catalog'

export type GameMode = 'digital' | 'physical'

export interface DraftState {
  boardId: string | null
  playerCount: number
  mode: GameMode
  assignments: (string | null)[]
  revealedSeats: number[]
}

export interface Setup {
  boardId: string | null
  playerCount: number
  mode: GameMode
  assignments: string[]
}

export const USED_FLAGS = [
  { id: 'used', label: '已用' },
  { id: 'antidoteUsed', label: '解藥已用' },
  { id: 'poisonUsed', label: '毒藥已用' },
] as const

export type UsedFlagId = (typeof USED_FLAGS)[number]['id']

export const TABLE_STATES = [
  { id: 'badge', label: '警長' },
  { id: 'silenced', label: '禁言' },
  { id: 'charmed', label: '魅惑' },
  { id: 'bound', label: '綁定' },
  { id: 'dreamed', label: '攝夢' },
  { id: 'protected', label: '保護' },
] as const

export type TableStateId = (typeof TABLE_STATES)[number]['id']

export type UsedFlagState = Record<UsedFlagId, boolean>
export type TableStateMap = Record<TableStateId, boolean>

export interface SeatRecord {
  roleId: string | null
  out: boolean
  copiedTarget: number | null
  usedFlags: UsedFlagState
  tableStates: TableStateMap
}

export interface ActiveGame {
  setup: Setup
  seats: SeatRecord[]
}

export interface NotebookState {
  draft: DraftState
  game: ActiveGame | null
}

export type StartError =
  | 'already-started'
  | 'invalid-player-count'
  | 'incomplete-assignments'
  | 'unknown-role'
  | 'unknown-board'

export type StartResult =
  | { ok: true; state: NotebookState }
  | { ok: false; error: StartError }

export type NotebookAction =
  | { type: 'draft/setBoard'; boardId: string | null }
  | { type: 'draft/setPlayerCount'; playerCount: number }
  | { type: 'draft/setMode'; mode: GameMode }
  | { type: 'draft/setAssignment'; seat: number; roleId: string | null }
  | { type: 'draft/setAssignments'; assignments: readonly (string | null)[] }
  | { type: 'draft/swapSeats'; a: number; b: number }
  | { type: 'draft/setReveal'; seat: number; revealed: boolean }
  | { type: 'game/start' }
  | { type: 'game/setRole'; seat: number; roleId: string | null }
  | { type: 'game/toggleOut'; seat: number }
  | { type: 'game/setCopiedTarget'; seat: number; target: number | null }
  | { type: 'game/toggleUsedFlag'; seat: number; flag: UsedFlagId }
  | { type: 'game/toggleTableState'; seat: number; tableState: TableStateId }
  | { type: 'game/reset' }

export function isSeat(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function isSeatInGame(value: unknown, playerCount: number): value is number {
  return isSeat(value) && value <= playerCount
}

export function isKnownRoleId(value: unknown): value is string {
  return typeof value === 'string' && rolesById.has(value)
}

function isKnownBoardId(value: unknown): value is string {
  return typeof value === 'string' && presetBoardsById.has(value)
}

export function isUsedFlagId(value: unknown): value is UsedFlagId {
  return USED_FLAGS.some((flag) => flag.id === value)
}

export function isTableStateId(value: unknown): value is TableStateId {
  return TABLE_STATES.some((tableState) => tableState.id === value)
}

function blankBooleans<K extends string>(
  keys: readonly K[],
): Record<K, boolean> {
  return Object.fromEntries(keys.map((key) => [key, false])) as Record<
    K,
    boolean
  >
}

export function createSeatRecord(roleId: string | null = null): SeatRecord {
  return {
    roleId,
    out: false,
    copiedTarget: null,
    usedFlags: blankBooleans(USED_FLAGS.map((flag) => flag.id)),
    tableStates: blankBooleans(TABLE_STATES.map((state) => state.id)),
  }
}

export function createDraft(overrides: Partial<DraftState> = {}): DraftState {
  const playerCount = overrides.playerCount ?? 0
  const assignments =
    overrides.assignments !== undefined
      ? [...overrides.assignments]
      : Array.from({ length: playerCount }, () => null)
  return {
    boardId: overrides.boardId ?? null,
    playerCount,
    mode: overrides.mode ?? 'digital',
    assignments,
    revealedSeats:
      overrides.revealedSeats !== undefined ? [...overrides.revealedSeats] : [],
  }
}

const DEFAULT_BOARD_ID = 'standard-333'

export function createDefaultDraft(): DraftState {
  const preset = presetBoardsById.get(DEFAULT_BOARD_ID)
  if (!preset) {
    return createDraft()
  }
  return createDraft({
    boardId: preset.id,
    playerCount: preset.playerCount,
    mode: 'digital',
    assignments: expandPreset(preset),
  })
}

export function createNotebook(): NotebookState {
  return { draft: createDefaultDraft(), game: null }
}

export function isPlaying(
  state: NotebookState,
): state is NotebookState & { game: ActiveGame } {
  return state.game !== null
}

export function startGame(state: NotebookState): StartResult {
  if (state.game !== null) {
    return { ok: false, error: 'already-started' }
  }
  const { draft } = state
  if (!Number.isInteger(draft.playerCount) || draft.playerCount < 1) {
    return { ok: false, error: 'invalid-player-count' }
  }
  if (draft.assignments.length !== draft.playerCount) {
    return { ok: false, error: 'incomplete-assignments' }
  }
  if (draft.boardId !== null && !isKnownBoardId(draft.boardId)) {
    return { ok: false, error: 'unknown-board' }
  }
  const assignments: string[] = []
  const seats: SeatRecord[] = []
  for (const roleId of draft.assignments) {
    if (roleId === null) {
      return { ok: false, error: 'incomplete-assignments' }
    }
    if (!isKnownRoleId(roleId)) {
      return { ok: false, error: 'unknown-role' }
    }
    assignments.push(roleId)
    seats.push(createSeatRecord(roleId))
  }
  const setup: Setup = {
    boardId: draft.boardId,
    playerCount: draft.playerCount,
    mode: draft.mode,
    assignments,
  }
  return {
    ok: true,
    state: { draft: state.draft, game: { setup, seats } },
  }
}

function updateDraft(
  state: NotebookState,
  update: (draft: DraftState) => DraftState,
): NotebookState {
  if (state.game !== null) {
    return state
  }
  return { ...state, draft: update(state.draft) }
}

function updateSeat(
  state: NotebookState,
  seat: number,
  update: (record: SeatRecord) => SeatRecord,
): NotebookState {
  const { game } = state
  if (!game || !isSeatInGame(seat, game.setup.playerCount)) {
    return state
  }
  const index = seat - 1
  const current = game.seats[index]
  const next = update(current)
  if (next === current) {
    return state
  }
  const seats = [...game.seats]
  seats[index] = next
  return { ...state, game: { ...game, seats } }
}

function isValidAssignmentList(
  assignments: readonly (string | null)[],
): boolean {
  return assignments.every(
    (roleId) => roleId === null || isKnownRoleId(roleId),
  )
}

export function notebookReducer(
  state: NotebookState,
  action: NotebookAction,
): NotebookState {
  switch (action.type) {
    case 'draft/setBoard':
      return updateDraft(state, (draft) => {
        if (action.boardId !== null && !isKnownBoardId(action.boardId)) {
          return draft
        }
        return { ...draft, boardId: action.boardId }
      })
    case 'draft/setPlayerCount': {
      const nextCount = action.playerCount
      if (!Number.isInteger(nextCount) || nextCount < 0) {
        return state
      }
      return updateDraft(state, (draft) => ({
        ...draft,
        playerCount: nextCount,
        assignments: Array.from(
          { length: nextCount },
          (_, index) => draft.assignments[index] ?? null,
        ),
        revealedSeats: draft.revealedSeats.filter((seat) => seat <= nextCount),
      }))
    }
    case 'draft/setMode':
      return updateDraft(state, (draft) => {
        if (action.mode !== 'digital' && action.mode !== 'physical') {
          return draft
        }
        return { ...draft, mode: action.mode }
      })
    case 'draft/setAssignment':
      return updateDraft(state, (draft) => {
        if (
          !isSeatInGame(action.seat, draft.playerCount) ||
          (action.roleId !== null && !isKnownRoleId(action.roleId))
        ) {
          return draft
        }
        const assignments = [...draft.assignments]
        assignments[action.seat - 1] = action.roleId
        return { ...draft, assignments }
      })
    case 'draft/setAssignments':
      return updateDraft(state, (draft) => {
        if (
          action.assignments.length !== draft.playerCount ||
          !isValidAssignmentList(action.assignments)
        ) {
          return draft
        }
        return { ...draft, assignments: [...action.assignments] }
      })
    case 'draft/swapSeats':
      return updateDraft(state, (draft) => {
        if (
          !isSeatInGame(action.a, draft.playerCount) ||
          !isSeatInGame(action.b, draft.playerCount) ||
          action.a === action.b
        ) {
          return draft
        }
        const assignments = [...draft.assignments]
        const first = assignments[action.a - 1] ?? null
        assignments[action.a - 1] = assignments[action.b - 1] ?? null
        assignments[action.b - 1] = first
        return { ...draft, assignments }
      })
    case 'draft/setReveal':
      return updateDraft(state, (draft) => {
        if (!isSeatInGame(action.seat, draft.playerCount)) {
          return draft
        }
        const revealed = new Set(draft.revealedSeats)
        if (action.revealed) {
          revealed.add(action.seat)
        } else {
          revealed.delete(action.seat)
        }
        return {
          ...draft,
          revealedSeats: [...revealed].sort((a, b) => a - b),
        }
      })
    case 'game/start': {
      const result = startGame(state)
      return result.ok ? result.state : state
    }
    case 'game/setRole':
      return updateSeat(state, action.seat, (record) => {
        if (action.roleId !== null && !isKnownRoleId(action.roleId)) {
          return record
        }
        return { ...record, roleId: action.roleId }
      })
    case 'game/toggleOut':
      return updateSeat(state, action.seat, (record) => ({
        ...record,
        out: !record.out,
      }))
    case 'game/setCopiedTarget': {
      const playerCount = state.game?.setup.playerCount
      if (playerCount === undefined) {
        return state
      }
      if (
        action.target !== null &&
        !isSeatInGame(action.target, playerCount)
      ) {
        return state
      }
      return updateSeat(state, action.seat, (record) => ({
        ...record,
        copiedTarget: action.target,
      }))
    }
    case 'game/toggleUsedFlag':
      return updateSeat(state, action.seat, (record) => {
        if (!isUsedFlagId(action.flag)) {
          return record
        }
        return {
          ...record,
          usedFlags: {
            ...record.usedFlags,
            [action.flag]: !record.usedFlags[action.flag],
          },
        }
      })
    case 'game/toggleTableState':
      return updateSeat(state, action.seat, (record) => {
        if (!isTableStateId(action.tableState)) {
          return record
        }
        return {
          ...record,
          tableStates: {
            ...record.tableStates,
            [action.tableState]: !record.tableStates[action.tableState],
          },
        }
      })
    case 'game/reset':
      return createNotebook()
  }
}
