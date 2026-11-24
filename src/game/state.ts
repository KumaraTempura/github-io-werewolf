import {
  findEffectiveTrackedField,
  getRole,
  initialTrackedState,
  presetBoardsById,
  rolesById,
  type TrackedField,
  type TrackedFieldValue,
  type TrackedState,
} from '../data/catalog'

export type GameMode = 'digital' | 'physical'

export type Phase = 'night' | 'daytime'

export interface PhaseState {
  cycle: number
  phase: Phase
}

export function initialPhase(): PhaseState {
  return { cycle: 1, phase: 'night' }
}

export function nextPhase(current: PhaseState): PhaseState {
  return current.phase === 'night'
    ? { cycle: current.cycle, phase: 'daytime' }
    : { cycle: current.cycle + 1, phase: 'night' }
}

const ELIMINATION_REASON_IDS = [
  'nightKill',
  'exile',
  'poison',
  'shot',
  'selfExpose',
  'bomb',
  'chained',
  'other',
] as const

export type EliminationReason = (typeof ELIMINATION_REASON_IDS)[number]

export const ELIMINATION_REASONS: readonly {
  id: EliminationReason
  label: string
}[] = [
  { id: 'nightKill', label: '夜間擊殺' },
  { id: 'exile', label: '放逐' },
  { id: 'poison', label: '毒殺' },
  { id: 'shot', label: '開槍' },
  { id: 'selfExpose', label: '自曝' },
  { id: 'bomb', label: '炸彈' },
  { id: 'chained', label: '連鎖' },
  { id: 'other', label: '其他' },
]

export const ELIMINATION_REASON_LABELS: Record<EliminationReason, string> = {
  nightKill: '夜間擊殺',
  exile: '放逐',
  poison: '毒殺',
  shot: '開槍',
  selfExpose: '自曝',
  bomb: '炸彈',
  chained: '連鎖',
  other: '其他',
}

const TABLE_STATE_IDS = [
  'badge',
  'silenced',
  'charmed',
  'bound',
  'dreamed',
  'poisoned',
] as const

export type TableStateId = (typeof TABLE_STATE_IDS)[number]

export const TABLE_STATES: readonly { id: TableStateId; label: string }[] = [
  { id: 'badge', label: '警長' },
  { id: 'silenced', label: '禁言' },
  { id: 'charmed', label: '魅惑' },
  { id: 'bound', label: '綁定' },
  { id: 'dreamed', label: '攝夢' },
  { id: 'poisoned', label: '中毒/負傷' },
]

export const TABLE_STATE_LABELS: Record<TableStateId, string> = {
  badge: '警長',
  silenced: '禁言',
  charmed: '魅惑',
  bound: '綁定',
  dreamed: '攝夢',
  poisoned: '中毒/負傷',
}

export type PeekCamp = 'good' | 'wolf'

export type PeekResult =
  | { kind: 'exactRole'; roleId: string }
  | { kind: 'goodOrWolf'; camp: PeekCamp }
  | { kind: 'teammateNumber'; seats: number[] }
  | { kind: 'lastExileCamp'; camp: PeekCamp }

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

export interface StartEvent {
  type: 'start'
  setup: Setup
}

export interface UsedEvent {
  type: 'used'
  seat: number
  used: boolean
}

export interface RoleStateEvent {
  type: 'roleState'
  seat: number
  field: string
  value: TrackedFieldValue
}

export interface TableStateEvent {
  type: 'tableState'
  state: TableStateId
  seats: number[]
}

export interface EliminationEvent {
  type: 'elimination'
  seat: number
  reason: EliminationReason
}

export interface NoteEvent {
  type: 'note'
  seat: number | null
  text: string
}

export interface PhaseEvent extends PhaseState {
  type: 'phase'
}

export interface ReviveEvent {
  type: 'revive'
  seat: number
}

export interface RoleStateUpdate {
  field: string
  value: TrackedFieldValue
}

export interface PeekEvent {
  type: 'peek'
  inspectorSeat: number
  targetSeat: number
  targetSeats?: number[]
  result: PeekResult
  updates?: readonly RoleStateUpdate[]
}

export type InGameEvent =
  | UsedEvent
  | RoleStateEvent
  | TableStateEvent
  | EliminationEvent
  | NoteEvent
  | PhaseEvent
  | ReviveEvent
  | PeekEvent

export type GameEvent = StartEvent | InGameEvent

export interface NotebookState {
  draft: DraftState
  events: GameEvent[]
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

export interface OutPlayer {
  seat: number
  reason: EliminationReason
}

export interface NoteEntry {
  seat: number | null
  text: string
}

export interface PeekEntry {
  inspectorSeat: number
  targetSeat: number
  targetSeats?: number[]
  result: PeekResult
}

export function peekTargetSeats(event: PeekEvent): readonly number[] {
  return event.targetSeats && event.targetSeats.length > 0
    ? event.targetSeats
    : [event.targetSeat]
}

export interface DerivedGame {
  setup: Setup
  currentPhase: PhaseState
  seatRoles: Readonly<Record<number, string>>
  usedBySeat: Readonly<Record<number, boolean>>
  roleStateBySeat: Readonly<Record<number, TrackedState>>
  tableStates: Readonly<Record<TableStateId, readonly number[]>>
  outPlayers: readonly OutPlayer[]
  notes: readonly NoteEntry[]
  peeks: readonly PeekEntry[]
  history: readonly GameEvent[]
}

export type NotebookAction =
  | { type: 'draft/setBoard'; boardId: string | null }
  | { type: 'draft/setPlayerCount'; playerCount: number }
  | { type: 'draft/setMode'; mode: GameMode }
  | { type: 'draft/setAssignment'; seat: number; roleId: string | null }
  | { type: 'draft/setAssignments'; assignments: readonly (string | null)[] }
  | { type: 'draft/swapSeats'; a: number; b: number }
  | { type: 'draft/setReveal'; seat: number; revealed: boolean }
  | { type: 'game/start' }
  | { type: 'game/append'; event: InGameEvent }
  | { type: 'game/undo' }
  | { type: 'game/clear' }

export function isSeat(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function isSeatInGame(value: unknown, playerCount: number): value is number {
  return isSeat(value) && value <= playerCount
}

function isKnownRoleId(value: unknown): value is string {
  return typeof value === 'string' && rolesById.has(value)
}

function isKnownBoardId(value: unknown): value is string {
  return typeof value === 'string' && presetBoardsById.has(value)
}

function isTableStateId(value: unknown): value is TableStateId {
  return typeof value === 'string' && (TABLE_STATE_IDS as readonly string[]).includes(value)
}

function isEliminationReason(value: unknown): value is EliminationReason {
  return (
    typeof value === 'string' &&
    (ELIMINATION_REASON_IDS as readonly string[]).includes(value)
  )
}

function isPeekCamp(value: unknown): value is PeekCamp {
  return value === 'good' || value === 'wolf'
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
    revealedSeats: overrides.revealedSeats !== undefined ? [...overrides.revealedSeats] : [],
  }
}

export function createNotebook(): NotebookState {
  return { draft: createDraft(), events: [] }
}

export function isPlaying(state: NotebookState): boolean {
  return state.events.length > 0
}

export function startGame(state: NotebookState): StartResult {
  if (state.events.length > 0) {
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
  for (const roleId of draft.assignments) {
    if (roleId === null) {
      return { ok: false, error: 'incomplete-assignments' }
    }
    if (!isKnownRoleId(roleId)) {
      return { ok: false, error: 'unknown-role' }
    }
    assignments.push(roleId)
  }
  const setup: Setup = {
    boardId: draft.boardId,
    playerCount: draft.playerCount,
    mode: draft.mode,
    assignments,
  }
  return {
    ok: true,
    state: {
      draft: state.draft,
      events: [{ type: 'start', setup }],
    },
  }
}

function cloneTrackedValue(value: TrackedFieldValue): TrackedFieldValue {
  if (!Array.isArray(value)) {
    return value
  }
  if (value.length > 0 && Array.isArray(value[0])) {
    return (value as [number, number][]).map((pair) => [pair[0], pair[1]] as [number, number])
  }
  return [...(value as number[])]
}

function isValidTrackedValue(field: TrackedField, value: TrackedFieldValue): boolean {
  switch (field.type) {
    case 'seat':
      return value === null || isSeat(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'seatList':
      return Array.isArray(value) && value.every(isSeat)
    case 'roleId':
      return value === null || isKnownRoleId(value)
    case 'counter':
      return (
        typeof value === 'number' &&
        Number.isInteger(value) &&
        value >= field.min &&
        value <= field.max
      )
    case 'enum':
      return value === null || (typeof value === 'string' && field.values.includes(value))
    case 'seatPairList':
      return (
        Array.isArray(value) &&
        value.every(
          (pair) =>
            Array.isArray(pair) &&
            pair.length === 2 &&
            pair.every((seat) => isSeat(seat)),
        )
      )
  }
}

function clonePeekResult(result: PeekResult): PeekResult {
  switch (result.kind) {
    case 'teammateNumber':
      return { kind: 'teammateNumber', seats: [...result.seats] }
    case 'exactRole':
    case 'goodOrWolf':
    case 'lastExileCamp':
      return { ...result }
  }
}

function isValidPeekResult(result: PeekResult, playerCount: number): boolean {
  switch (result.kind) {
    case 'exactRole':
      return isKnownRoleId(result.roleId)
    case 'goodOrWolf':
    case 'lastExileCamp':
      return isPeekCamp(result.camp)
    case 'teammateNumber':
      return result.seats.every((seat) => isSeatInGame(seat, playerCount))
  }
}

function normalizePeekUpdates(
  updates: readonly RoleStateUpdate[] | undefined,
  derived: DerivedGame,
  inspectorSeat: number,
): RoleStateUpdate[] | null {
  const role = getRole(derived.seatRoles[inspectorSeat] ?? '')
  if (!role) {
    return null
  }
  if (updates === undefined) {
    return []
  }
  const seen = new Set<string>()
  const normalized: RoleStateUpdate[] = []
  for (const update of updates) {
    if (typeof update.field !== 'string' || seen.has(update.field)) {
      return null
    }
    const field = role.trackedFields.find((entry) => entry.key === update.field)
    if (!field || !isValidTrackedValue(field, update.value)) {
      return null
    }
    seen.add(update.field)
    normalized.push({
      field: field.key,
      value: cloneTrackedValue(update.value),
    })
  }
  return normalized
}

function normalizeEvent(event: InGameEvent, derived: DerivedGame): InGameEvent | null {
  const { playerCount } = derived.setup
  switch (event.type) {
    case 'used':
      if (!isSeatInGame(event.seat, playerCount) || typeof event.used !== 'boolean') {
        return null
      }
      return { type: 'used', seat: event.seat, used: event.used }
    case 'roleState': {
      if (!isSeatInGame(event.seat, playerCount)) {
        return null
      }
      const field = findEffectiveTrackedField(
        getRole(derived.seatRoles[event.seat] ?? ''),
        derived.roleStateBySeat[event.seat],
        event.field,
      )
      if (!field || !isValidTrackedValue(field, event.value)) {
        return null
      }
      return {
        type: 'roleState',
        seat: event.seat,
        field: field.key,
        value: cloneTrackedValue(event.value),
      }
    }
    case 'tableState': {
      if (!isTableStateId(event.state)) {
        return null
      }
      if (!event.seats.every((seat) => isSeatInGame(seat, playerCount))) {
        return null
      }
      return {
        type: 'tableState',
        state: event.state,
        seats: [...new Set(event.seats)],
      }
    }
    case 'elimination':
      if (
        !isSeatInGame(event.seat, playerCount) ||
        !isEliminationReason(event.reason) ||
        derived.outPlayers.some((player) => player.seat === event.seat)
      ) {
        return null
      }
      return { type: 'elimination', seat: event.seat, reason: event.reason }
    case 'note': {
      if (event.seat !== null && !isSeatInGame(event.seat, playerCount)) {
        return null
      }
      const text = event.text.trim()
      if (text.length === 0) {
        return null
      }
      return { type: 'note', seat: event.seat, text }
    }
    case 'phase': {
      if (!Number.isInteger(event.cycle) || event.cycle < 1) {
        return null
      }
      if (event.phase !== 'night' && event.phase !== 'daytime') {
        return null
      }
      const current = derived.currentPhase
      if (event.phase === 'daytime') {
        if (current.phase !== 'night' || event.cycle !== current.cycle) {
          return null
        }
      } else if (
        current.phase !== 'daytime' ||
        event.cycle !== current.cycle + 1
      ) {
        return null
      }
      return { type: 'phase', cycle: event.cycle, phase: event.phase }
    }
    case 'revive': {
      if (
        !isSeatInGame(event.seat, playerCount) ||
        !derived.outPlayers.some((player) => player.seat === event.seat)
      ) {
        return null
      }
      return { type: 'revive', seat: event.seat }
    }
    case 'peek': {
      if (
        !isSeatInGame(event.inspectorSeat, playerCount) ||
        !isSeatInGame(event.targetSeat, playerCount) ||
        !isValidPeekResult(event.result, playerCount)
      ) {
        return null
      }
      const updates = normalizePeekUpdates(
        event.updates,
        derived,
        event.inspectorSeat,
      )
      if (updates === null) {
        return null
      }
      const base = {
        type: 'peek' as const,
        inspectorSeat: event.inspectorSeat,
        targetSeat: event.targetSeat,
        result: clonePeekResult(event.result),
        ...(updates.length > 0 ? { updates } : {}),
      }
      if (event.targetSeats !== undefined) {
        if (
          event.targetSeats.length === 0 ||
          event.targetSeats[0] !== event.targetSeat ||
          !event.targetSeats.every((seat) => isSeatInGame(seat, playerCount)) ||
          new Set(event.targetSeats).size !== event.targetSeats.length
        ) {
          return null
        }
        return {
          ...base,
          targetSeats: [...event.targetSeats],
        }
      }
      return base
    }
  }
}

export function appendEvent(state: NotebookState, event: InGameEvent): NotebookState {
  const derived = deriveGame(state.events)
  if (!derived) {
    return state
  }
  const normalized = normalizeEvent(event, derived)
  if (!normalized) {
    return state
  }
  return { ...state, events: [...state.events, normalized] }
}

export function undoLast(state: NotebookState): NotebookState {
  if (state.events.length === 0) {
    return state
  }
  return { ...state, events: state.events.slice(0, -1) }
}

export function deriveGame(events: readonly GameEvent[]): DerivedGame | null {
  if (events.length === 0) {
    return null
  }
  const first = events[0]
  if (first.type !== 'start') {
    return null
  }
  const setup = first.setup
  const seatRoles: Record<number, string> = {}
  const usedBySeat: Record<number, boolean> = {}
  const roleStateBySeat: Record<number, TrackedState> = {}

  for (let seat = 1; seat <= setup.playerCount; seat += 1) {
    const roleId = setup.assignments[seat - 1]
    if (!roleId) {
      return null
    }
    const role = getRole(roleId)
    if (!role) {
      return null
    }
    seatRoles[seat] = roleId
    usedBySeat[seat] = false
    roleStateBySeat[seat] = initialTrackedState(role)
  }

  const tableStates: Record<TableStateId, number[]> = {
    badge: [],
    silenced: [],
    charmed: [],
    bound: [],
    dreamed: [],
    poisoned: [],
  }
  const outPlayers: OutPlayer[] = []
  const notes: NoteEntry[] = []
  const peeks: PeekEntry[] = []
  let currentPhase: PhaseState = initialPhase()

  for (const event of events.slice(1)) {
    switch (event.type) {
      case 'used':
        if (usedBySeat[event.seat] !== undefined) {
          usedBySeat[event.seat] = event.used
        }
        break
      case 'roleState': {
        const roleState = roleStateBySeat[event.seat]
        const field = findEffectiveTrackedField(
          getRole(seatRoles[event.seat] ?? ''),
          roleState,
          event.field,
        )
        if (roleState && field && isValidTrackedValue(field, event.value)) {
          roleState[event.field] = cloneTrackedValue(event.value)
        }
        break
      }
      case 'tableState':
        if (isTableStateId(event.state)) {
          tableStates[event.state] = [...event.seats]
        }
        break
      case 'elimination':
        if (!outPlayers.some((player) => player.seat === event.seat)) {
          outPlayers.push({ seat: event.seat, reason: event.reason })
        }
        break
      case 'note':
        notes.push({ seat: event.seat, text: event.text })
        break
      case 'phase':
        currentPhase = { cycle: event.cycle, phase: event.phase }
        break
      case 'revive': {
        const index = outPlayers.findIndex((player) => player.seat === event.seat)
        if (index >= 0) {
          outPlayers.splice(index, 1)
        }
        break
      }
      case 'peek': {
        const entry: PeekEntry = {
          inspectorSeat: event.inspectorSeat,
          targetSeat: event.targetSeat,
          result: clonePeekResult(event.result),
        }
        if (event.targetSeats) {
          entry.targetSeats = [...event.targetSeats]
        }
        peeks.push(entry)
        const roleState = roleStateBySeat[event.inspectorSeat]
        if (roleState && event.updates) {
          for (const update of event.updates) {
            roleState[update.field] = cloneTrackedValue(update.value)
          }
        }
        break
      }
      case 'start':
        break
    }
  }

  return {
    setup: { ...setup, assignments: [...setup.assignments] },
    currentPhase,
    seatRoles,
    usedBySeat,
    roleStateBySeat,
    tableStates,
    outPlayers,
    notes,
    peeks,
    history: [...events],
  }
}

function updateDraft(
  state: NotebookState,
  update: (draft: DraftState) => DraftState,
): NotebookState {
  if (isPlaying(state)) {
    return state
  }
  return { ...state, draft: update(state.draft) }
}

function isValidAssignmentList(assignments: readonly (string | null)[]): boolean {
  return assignments.every((roleId) => roleId === null || isKnownRoleId(roleId))
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
    case 'game/append':
      return appendEvent(state, action.event)
    case 'game/undo':
      return undoLast(state)
    case 'game/clear':
      return createNotebook()
  }
}
