import { presetBoardsById, rolesById } from '../data/catalog'
import {
  TABLE_STATES,
  USED_FLAGS,
  createNotebook,
  isSeat,
  type ActiveGame,
  type DraftState,
  type GameMode,
  type NotebookState,
  type SeatRecord,
  type Setup,
  type TableStateMap,
  type UsedFlagState,
} from './state'

export const NOTEBOOK_STORAGE_KEY = 'werewolf-judge-notebook:v1'

const STORAGE_VERSION = 3

const LEGACY_VERSIONS = new Set([1, 2])

const USED_FLAG_IDS = USED_FLAGS.map((flag) => flag.id)
const TABLE_STATE_IDS = TABLE_STATES.map((tableState) => tableState.id)

export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

interface StoredNotebook {
  version: number
  draft: DraftState
  game: ActiveGame | null
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
  if (
    !Array.isArray(revealedSeats) ||
    !revealedSeats.every((seat) => isSeat(seat) && seat <= count)
  ) {
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

function parseBooleanRecord<K extends string>(
  raw: unknown,
  keys: readonly K[],
): Record<K, boolean> | null {
  if (!isRecord(raw)) {
    return null
  }
  const record = {} as Record<K, boolean>
  for (const key of keys) {
    if (typeof raw[key] !== 'boolean') {
      return null
    }
    record[key] = raw[key] as boolean
  }
  return record
}

function parseUsedFlags(raw: unknown): UsedFlagState | null {
  return parseBooleanRecord(raw, USED_FLAG_IDS)
}

function parseTableStates(raw: unknown): TableStateMap | null {
  return parseBooleanRecord(raw, TABLE_STATE_IDS)
}

function parseSeat(raw: unknown, playerCount: number): SeatRecord | null {
  if (!isRecord(raw)) {
    return null
  }
  const { roleId, out, copiedTarget, usedFlags, tableStates } = raw
  if (roleId !== null && !isKnownRoleId(roleId)) {
    return null
  }
  if (typeof out !== 'boolean') {
    return null
  }
  if (
    copiedTarget !== null &&
    !(isSeat(copiedTarget) && copiedTarget <= playerCount)
  ) {
    return null
  }
  const parsedUsedFlags = parseUsedFlags(usedFlags)
  const parsedTableStates = parseTableStates(tableStates)
  if (!parsedUsedFlags || !parsedTableStates) {
    return null
  }
  return {
    roleId,
    out,
    copiedTarget,
    usedFlags: parsedUsedFlags,
    tableStates: parsedTableStates,
  }
}

function parseGame(raw: unknown): ActiveGame | null {
  if (!isRecord(raw)) {
    return null
  }
  const setup = parseSetup(raw.setup)
  if (!setup || !Array.isArray(raw.seats)) {
    return null
  }
  if (raw.seats.length !== setup.playerCount) {
    return null
  }
  const seats: SeatRecord[] = []
  for (const rawSeat of raw.seats) {
    const seat = parseSeat(rawSeat, setup.playerCount)
    if (!seat) {
      return null
    }
    seats.push(seat)
  }
  return { setup, seats }
}

function parseNotebook(raw: unknown): NotebookState | null {
  if (!isRecord(raw) || raw.version !== STORAGE_VERSION) {
    return null
  }
  const draft = parseDraft(raw.draft)
  if (!draft) {
    return null
  }
  const game = raw.game === null ? null : parseGame(raw.game)
  if (raw.game !== null && !game) {
    return null
  }
  return { draft, game }
}

function isLegacySave(raw: unknown): boolean {
  return (
    isRecord(raw) &&
    typeof raw.version === 'number' &&
    LEGACY_VERSIONS.has(raw.version)
  )
}

interface LoadedNotebook {
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
    const state = parseNotebook(parsed)
    if (state) {
      return { state, legacyDiscarded: false }
    }
    return {
      state: createNotebook(),
      legacyDiscarded: isLegacySave(parsed),
    }
  } catch {
    return { state: createNotebook(), legacyDiscarded: false }
  }
}

export function saveNotebook(
  state: NotebookState,
  storage: KeyValueStorage = window.localStorage,
): boolean {
  const stored: StoredNotebook = {
    version: STORAGE_VERSION,
    draft: state.draft,
    game: state.game,
  }
  try {
    storage.setItem(NOTEBOOK_STORAGE_KEY, JSON.stringify(stored))
    return true
  } catch {
    return false
  }
}
