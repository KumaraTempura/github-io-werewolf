import {
  presetBoardsById,
  rolesById,
  type TrackedFieldValue,
} from '../data/catalog'
import {
  appendEvent,
  createNotebook,
  isSeat,
  type DraftState,
  type EliminationReason,
  type GameEvent,
  type GameMode,
  type InGameEvent,
  type NotebookState,
  type PeekCamp,
  type PeekResult,
  type Setup,
  type StartEvent,
  type TableStateId,
} from './state'

export const NOTEBOOK_STORAGE_KEY = 'werewolf-judge-notebook:v1'

const STORAGE_VERSION = 2

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface StoredNotebook {
  version: number
  draft: DraftState
  events: GameEvent[]
}

type UnknownRecord = Record<string, unknown>

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isKnownRoleId(value: unknown): value is string {
  return typeof value === 'string' && rolesById.has(value)
}

function isKnownBoardId(value: unknown): value is string {
  return typeof value === 'string' && presetBoardsById.has(value)
}

function isGameMode(value: unknown): value is GameMode {
  return value === 'digital' || value === 'physical'
}

function isPeekCamp(value: unknown): value is PeekCamp {
  return value === 'good' || value === 'wolf'
}

function parseDraft(raw: unknown): DraftState | null {
  if (!isRecord(raw)) {
    return null
  }
  const { boardId, playerCount, mode, assignments, revealedSeats } = raw
  if (boardId !== null && !isKnownBoardId(boardId)) {
    return null
  }
  if (!Number.isInteger(playerCount) || (playerCount as number) < 0) {
    return null
  }
  const count = playerCount as number
  if (!isGameMode(mode)) {
    return null
  }
  if (!Array.isArray(assignments) || assignments.length !== count) {
    return null
  }
  if (!assignments.every((roleId) => roleId === null || isKnownRoleId(roleId))) {
    return null
  }
  if (!Array.isArray(revealedSeats) || !revealedSeats.every((seat) => isSeat(seat) && seat <= count)) {
    return null
  }
  if (new Set(revealedSeats).size !== revealedSeats.length) {
    return null
  }
  return {
    boardId,
    playerCount: count,
    mode,
    assignments: [...assignments],
    revealedSeats: [...revealedSeats],
  }
}

function parseSetup(raw: unknown): Setup | null {
  if (!isRecord(raw)) {
    return null
  }
  const { boardId, playerCount, mode, assignments } = raw
  if (boardId !== null && !isKnownBoardId(boardId)) {
    return null
  }
  if (!Number.isInteger(playerCount) || (playerCount as number) < 1) {
    return null
  }
  const count = playerCount as number
  if (!isGameMode(mode)) {
    return null
  }
  if (
    !Array.isArray(assignments) ||
    assignments.length !== count ||
    !assignments.every(isKnownRoleId)
  ) {
    return null
  }
  return {
    boardId,
    playerCount: count,
    mode,
    assignments: [...assignments],
  }
}

function parseStartEvent(raw: unknown): StartEvent | null {
  if (!isRecord(raw) || raw.type !== 'start') {
    return null
  }
  const setup = parseSetup(raw.setup)
  return setup ? { type: 'start', setup } : null
}

function isTrackedValueShape(value: unknown): value is TrackedFieldValue {
  if (value === null) {
    return true
  }
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return true
  }
  if (!Array.isArray(value)) {
    return false
  }
  return value.every(
    (entry) =>
      typeof entry === 'number' ||
      (Array.isArray(entry) &&
        entry.length === 2 &&
        entry.every((item) => typeof item === 'number')),
  )
}

function parsePeekResult(raw: unknown): PeekResult | null {
  if (!isRecord(raw)) {
    return null
  }
  switch (raw.kind) {
    case 'exactRole':
      return isKnownRoleId(raw.roleId)
        ? { kind: 'exactRole', roleId: raw.roleId }
        : null
    case 'goodOrWolf':
      return isPeekCamp(raw.camp) ? { kind: 'goodOrWolf', camp: raw.camp } : null
    case 'lastExileCamp':
      return isPeekCamp(raw.camp) ? { kind: 'lastExileCamp', camp: raw.camp } : null
    case 'teammateNumber':
      return Array.isArray(raw.seats) && raw.seats.every(isSeat)
        ? { kind: 'teammateNumber', seats: [...raw.seats] }
        : null
    default:
      return null
  }
}

function parseInGameEvent(raw: unknown): InGameEvent | null {
  if (!isRecord(raw)) {
    return null
  }
  switch (raw.type) {
    case 'used':
      return isSeat(raw.seat) && typeof raw.used === 'boolean'
        ? { type: 'used', seat: raw.seat, used: raw.used }
        : null
    case 'roleState':
      return isSeat(raw.seat) &&
        typeof raw.field === 'string' &&
        isTrackedValueShape(raw.value)
        ? { type: 'roleState', seat: raw.seat, field: raw.field, value: raw.value }
        : null
    case 'tableState':
      return typeof raw.state === 'string' &&
        Array.isArray(raw.seats) &&
        raw.seats.every(isSeat)
        ? {
            type: 'tableState',
            state: raw.state as TableStateId,
            seats: [...raw.seats],
          }
        : null
    case 'elimination':
      return isSeat(raw.seat) && typeof raw.reason === 'string'
        ? {
            type: 'elimination',
            seat: raw.seat,
            reason: raw.reason as EliminationReason,
          }
        : null
    case 'note':
      return (raw.seat === null || isSeat(raw.seat)) && typeof raw.text === 'string'
        ? { type: 'note', seat: raw.seat, text: raw.text }
        : null
    case 'phase':
      return Number.isInteger(raw.cycle) &&
        (raw.cycle as number) >= 1 &&
        (raw.phase === 'night' || raw.phase === 'daytime')
        ? { type: 'phase', cycle: raw.cycle as number, phase: raw.phase }
        : null
    case 'revive':
      return isSeat(raw.seat) ? { type: 'revive', seat: raw.seat } : null
    case 'peek': {
      const result = parsePeekResult(raw.result)
      if (!isSeat(raw.inspectorSeat) || !isSeat(raw.targetSeat) || !result) {
        return null
      }
      if (raw.targetSeats === undefined) {
        return {
          type: 'peek',
          inspectorSeat: raw.inspectorSeat,
          targetSeat: raw.targetSeat,
          result,
        }
      }
      if (
        !Array.isArray(raw.targetSeats) ||
        raw.targetSeats.length === 0 ||
        !raw.targetSeats.every(isSeat) ||
        new Set(raw.targetSeats).size !== raw.targetSeats.length ||
        raw.targetSeats[0] !== raw.targetSeat
      ) {
        return null
      }
      return {
        type: 'peek',
        inspectorSeat: raw.inspectorSeat,
        targetSeat: raw.targetSeat,
        targetSeats: [...raw.targetSeats],
        result,
      }
    }
    default:
      return null
  }
}

function setupMatchesDraft(setup: Setup, draft: DraftState): boolean {
  return (
    setup.boardId === draft.boardId &&
    setup.playerCount === draft.playerCount &&
    setup.mode === draft.mode &&
    setup.assignments.length === draft.assignments.length &&
    setup.assignments.every((roleId, index) => roleId === draft.assignments[index])
  )
}

export function parseNotebook(raw: unknown): NotebookState | null {
  if (!isRecord(raw) || raw.version !== STORAGE_VERSION) {
    return null
  }
  const draft = parseDraft(raw.draft)
  if (!draft || !Array.isArray(raw.events)) {
    return null
  }
  if (raw.events.length === 0) {
    return { draft, events: [] }
  }
  const start = parseStartEvent(raw.events[0])
  if (!start || !setupMatchesDraft(start.setup, draft)) {
    return null
  }
  let state: NotebookState = { draft, events: [start] }
  for (const rawEvent of raw.events.slice(1)) {
    const event = parseInGameEvent(rawEvent)
    if (!event) {
      return null
    }
    const next = appendEvent(state, event)
    if (next.events.length !== state.events.length + 1) {
      return null
    }
    state = next
  }
  return state
}

export interface LoadedNotebook {
  state: NotebookState
  legacyDiscarded: boolean
}

export function loadNotebookWithStatus(
  storage: KeyValueStorage = window.localStorage,
): LoadedNotebook {
  try {
    const raw = storage.getItem(NOTEBOOK_STORAGE_KEY)
    if (raw === null) {
      return { state: createNotebook(), legacyDiscarded: false }
    }
    const parsed: unknown = JSON.parse(raw)
    return {
      state: parseNotebook(parsed) ?? createNotebook(),
      legacyDiscarded: isRecord(parsed) && parsed.version === 1,
    }
  } catch {
    return { state: createNotebook(), legacyDiscarded: false }
  }
}

export function isLegacyNotebook(
  storage: KeyValueStorage = window.localStorage,
): boolean {
  return loadNotebookWithStatus(storage).legacyDiscarded
}

export function loadNotebook(
  storage: KeyValueStorage = window.localStorage,
): NotebookState {
  return loadNotebookWithStatus(storage).state
}

export function saveNotebook(
  state: NotebookState,
  storage: KeyValueStorage = window.localStorage,
): boolean {
  const stored: StoredNotebook = {
    version: STORAGE_VERSION,
    draft: state.draft,
    events: state.events,
  }
  try {
    storage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}

export function clearStoredNotebook(
  storage: KeyValueStorage = window.localStorage,
): void {
  try {
    storage.removeItem(NOTEBOOK_STORAGE_KEY)
  } catch {
    return
  }
}
