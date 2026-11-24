import { useEffect, useState } from 'react'
import {
  getRole,
  presetBoardsById,
  roles,
  type TrackedField,
  type TrackedFieldValue,
} from '../data/catalog'
import {
  ELIMINATION_REASON_LABELS,
  ELIMINATION_REASONS,
  TABLE_STATES,
  deriveGame,
  nextPhase,
  type DerivedGame,
  type EliminationReason,
  type NotebookState,
  type Setup,
  type TableStateId,
} from '../game/state'
import type { NotebookDispatch } from '../game/useNotebook'
import {
  advancePhaseLabel,
  countActionEvents,
  cycleTabLabel,
  describeEvent,
  eventKindLabel,
  formatTrackedValue,
  hasCatalogAbility,
  isNightKillProtectionField,
  isShotField,
  logCycles,
  peekActionLabel,
  phaseLabel,
  phaseMarkerLabel,
} from './dashboard'
import PeekFlow from './PeekFlow'

interface DashboardScreenProps {
  state: NotebookState
  dispatch: NotebookDispatch
  onClear: () => void
}

type OpenSheet =
  | { kind: 'seat'; seat: number }
  | { kind: 'log' }
  | { kind: 'undoPeek' }
  | { kind: 'clear' }
  | null

export default function DashboardScreen({
  state,
  dispatch,
  onClear,
}: DashboardScreenProps) {
  const [sheet, setSheet] = useState<OpenSheet>(null)
  const [peekSeat, setPeekSeat] = useState<number | null>(null)
  const game = deriveGame(state.events)

  useEffect(() => {
    if (!sheet) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setSheet(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sheet])

  if (!game) {
    return null
  }

  const alive = game.setup.playerCount - game.outPlayers.length
  const actionCount = countActionEvents(game.history)
  const lastEvent = game.history[game.history.length - 1]
  const outBySeat = new Map(game.outPlayers.map((player) => [player.seat, player.reason]))

  function performUndo() {
    setSheet(null)
    dispatch({ type: 'game/undo' })
  }

  function requestUndo() {
    if (lastEvent?.type === 'peek') {
      setSheet({ kind: 'undoPeek' })
      return
    }
    performUndo()
  }

  function advancePhase() {
    if (!game) {
      return
    }
    dispatch({
      type: 'game/append',
      event: { type: 'phase', ...nextPhase(game.currentPhase) },
    })
  }

  function openPeek(seat: number) {
    setSheet(null)
    setPeekSeat(seat)
  }

  function closePeek() {
    const seat = peekSeat
    setPeekSeat(null)
    if (seat !== null) {
      setSheet({ kind: 'seat', seat })
    }
  }

  function clearGame() {
    setSheet(null)
    onClear()
  }

  return (
    <main className="shell game">
      <header className="app-head">
        <p className="brand">
          法官筆記<span className="brand__tag">單機</span>
        </p>
        <button
          type="button"
          className="text-button"
          onClick={() => setSheet({ kind: 'clear' })}
        >
          清除這一局
        </button>
      </header>

      <header className="game-head">
        <div>
          <p className="eyebrow">
            JUDGE ·{' '}
            {game.setup.mode === 'digital' ? '數位發牌' : '實體發牌'}
          </p>
          <h1 className="title title--small">{boardTitle(game.setup)}</h1>
        </div>
        <p className="game-head__alive">
          <strong>{alive}</strong>
          <span> / {game.setup.playerCount} 在場</span>
        </p>
      </header>

      <section className="phase-bar" aria-label="目前階段">
        <div className="phase-bar__now">
          <span className="phase-bar__eyebrow">目前階段</span>
          <strong>
            {phaseLabel(game.currentPhase.cycle, game.currentPhase.phase)}
          </strong>
        </div>
        <button
          type="button"
          className="phase-bar__advance"
          onClick={advancePhase}
        >
          {advancePhaseLabel(game.currentPhase.phase)}
        </button>
      </section>

      <section aria-label="座位一覽">
        <h2 className="field-label">座位</h2>
        <div className="game-grid">
          {Array.from({ length: game.setup.playerCount }, (_, index) => {
            const seat = index + 1
            const role = getRole(game.seatRoles[seat] ?? '')
            const outReason = outBySeat.get(seat)
            const states = TABLE_STATES.filter((entry) =>
              game.tableStates[entry.id].includes(seat),
            )
            const used = game.usedBySeat[seat] ?? false
            const empty = !outReason && states.length === 0 && !used
            return (
              <button
                type="button"
                className={`game-seat${outReason ? ' is-out' : ''}`}
                key={seat}
                aria-label={`座位 ${seat} 詳情`}
                onClick={() => setSheet({ kind: 'seat', seat })}
              >
                <span className="game-seat__top">
                  <span className="game-seat__num">{seat}</span>
                  <span
                    className={`camp-dot camp-dot--${role?.campKey ?? 'villager'}`}
                    aria-hidden="true"
                  />
                </span>
                <span className="game-seat__role">{role?.name ?? '—'}</span>
                <span className="game-seat__tags">
                  {used ? <i className="tag--used">已用</i> : null}
                  {states.map((entry) => (
                    <i key={entry.id}>{entry.label}</i>
                  ))}
                  {outReason ? (
                    <i className="tag--out">
                      出局 · {ELIMINATION_REASON_LABELS[outReason]}
                    </i>
                  ) : null}
                  {empty ? <i className="tag--none">—</i> : null}
                </span>
              </button>
            )
          })}
        </div>
        <p className="sheet-note">點座位使用技能、設定場上狀態與出局。</p>
      </section>

      <nav className="dash-dock" aria-label="法官操作">
        <button
          type="button"
          aria-label="事件記錄"
          onClick={() => setSheet({ kind: 'log' })}
        >
          事件 <span className="dash-dock__count">{actionCount}</span>
        </button>
        <button type="button" aria-label="復原上一步" onClick={requestUndo}>
          復原
        </button>
      </nav>

      {sheet ? (
        <div
          className="sheet-backdrop"
          aria-hidden="true"
          onClick={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === 'seat' ? (
        <SeatSheet
          seat={sheet.seat}
          game={game}
          dispatch={dispatch}
          onPeek={openPeek}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === 'log' ? (
        <EventLogSheet
          setup={game.setup}
          history={game.history}
          currentCycle={game.currentPhase.cycle}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {peekSeat !== null ? (
        <PeekFlow
          game={game}
          dispatch={dispatch}
          inspectorSeat={peekSeat}
          onClose={closePeek}
        />
      ) : null}

      {sheet?.kind === 'undoPeek' ? (
        <UndoPeekSheet
          onConfirm={performUndo}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === 'clear' ? (
        <ClearSheet onConfirm={clearGame} onClose={() => setSheet(null)} />
      ) : null}
    </main>
  )
}

function boardTitle(setup: Setup): string {
  if (setup.boardId === null) {
    return '自訂板子'
  }
  return presetBoardsById.get(setup.boardId)?.name ?? '自訂板子'
}

interface SeatSheetProps {
  seat: number
  game: DerivedGame
  dispatch: NotebookDispatch
  onPeek: (seat: number) => void
  onClose: () => void
}

function SeatSheet({ seat, game, dispatch, onPeek, onClose }: SeatSheetProps) {
  const role = getRole(game.seatRoles[seat] ?? '')
  const out = game.outPlayers.find((player) => player.seat === seat)
  const used = game.usedBySeat[seat] ?? false
  const showSkill = role !== undefined && hasCatalogAbility(role)
  const peekKind = role && role.peekKind !== 'none' ? role.peekKind : null
  const peekLabel = peekKind ? peekActionLabel(peekKind) : null

  function setUsed(used: boolean) {
    dispatch({ type: 'game/append', event: { type: 'used', seat, used } })
  }

  function toggleTableState(state: TableStateId, active: boolean) {
    const seats = active
      ? [...game.tableStates[state], seat].sort((a, b) => a - b)
      : game.tableStates[state].filter((entry) => entry !== seat)
    dispatch({ type: 'game/append', event: { type: 'tableState', state, seats } })
  }

  function updateField(field: TrackedField, value: TrackedFieldValue) {
    dispatch({
      type: 'game/append',
      event: { type: 'roleState', seat, field: field.key, value },
    })
    if (
      isNightKillProtectionField(field.key) &&
      typeof value === 'number' &&
      game.outPlayers.some(
        (player) => player.seat === value && player.reason === 'nightKill',
      )
    ) {
      dispatch({ type: 'game/append', event: { type: 'revive', seat: value } })
    }
    if (
      isShotField(field.key) &&
      typeof value === 'number' &&
      !game.outPlayers.some((player) => player.seat === value)
    ) {
      dispatch({ type: 'game/append', event: { type: 'elimination', seat: value, reason: 'shot' } })
    }
  }

  function eliminate(reason: EliminationReason) {
    dispatch({ type: 'game/append', event: { type: 'elimination', seat, reason } })
  }

  function revive() {
    dispatch({ type: 'game/append', event: { type: 'revive', seat } })
  }

  return (
    <section
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`座位 ${seat} 狀態`}
    >
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <h2>座位 {seat}</h2>
        <button
          type="button"
          className="sheet-close"
          aria-label="關閉"
          autoFocus
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="sheet-body">
        <p className="sheet-roleline">
          <span
            className={`camp-dot camp-dot--${role?.campKey ?? 'villager'}`}
            aria-hidden="true"
          />
          {role ? `${role.name} · ${role.camp}` : '—'}
        </p>
        {role ? <p className="sheet-ability">{role.ability}</p> : null}
        {role?.peekNote ? <p className="sheet-note">{role.peekNote}</p> : null}

        {out ? (
          <div className="out-banner" role="status">
            <span className="out-banner__label">已出局</span>
            <strong>{ELIMINATION_REASON_LABELS[out.reason]}</strong>
            {out.reason === 'nightKill' ? (
              <button
                type="button"
                className="revive-btn"
                aria-label={`座位 ${seat} 復活`}
                onClick={revive}
              >
                復活
              </button>
            ) : null}
            <p className="sheet-note">
              復原只移除最後一筆事件；若要更正較早的紀錄，需先復原它之後的事件。
            </p>
          </div>
        ) : null}

        {showSkill && role ? (
          <section className="seat-section" aria-label="技能">
            <h3 className="seat-section__head">技能</h3>
            <div className="skill-actions">
              <button
                type="button"
                className={`used-toggle${used ? ' is-on' : ''}`}
                aria-label={`座位 ${seat} 已使用`}
                aria-pressed={used}
                onClick={() => setUsed(!used)}
              >
                {used ? '已使用 · 點擊取消' : '標記為已使用'}
              </button>
              {peekLabel ? (
                <button
                  type="button"
                  className="skill-action"
                  aria-label={`座位 ${seat} ${peekLabel}`}
                  onClick={() => onPeek(seat)}
                >
                  {peekLabel}
                </button>
              ) : null}
            </div>
            {role.trackedFields.map((field) => (
              <TrackedFieldEditor
                key={field.key}
                seat={seat}
                field={field}
                value={game.roleStateBySeat[seat]?.[field.key]}
                playerCount={game.setup.playerCount}
                onChange={(value) => updateField(field, value)}
              />
            ))}
          </section>
        ) : null}

        <section className="seat-section" aria-label="場上狀態">
          <h3 className="seat-section__head">場上狀態</h3>
          <p className="sheet-note">每個狀態獨立標記，再點一次取消。</p>
          <div className="state-grid">
            {TABLE_STATES.map((entry) => {
              const active = game.tableStates[entry.id].includes(seat)
              return (
                <button
                  type="button"
                  key={entry.id}
                  className={`state-chip${active ? ' is-on' : ''}`}
                  aria-label={`座位 ${seat} ${entry.label}`}
                  aria-pressed={active}
                  onClick={() => toggleTableState(entry.id, !active)}
                >
                  {entry.label}
                </button>
              )
            })}
          </div>
        </section>

        {out ? null : (
          <section className="seat-section" aria-label="標記出局">
            <h3 className="seat-section__head">出局</h3>
            <p className="sheet-note">選擇原因後立即記錄；出局只能用復原退回。</p>
            <div className="reason-grid">
              {ELIMINATION_REASONS.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className="reason-chip"
                  aria-label={`座位 ${seat} 出局 ${entry.label}`}
                  onClick={() => eliminate(entry.id)}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    </section>
  )
}

interface TrackedFieldEditorProps {
  seat: number
  field: TrackedField
  value: TrackedFieldValue | undefined
  playerCount: number
  onChange: (value: TrackedFieldValue) => void
}

function TrackedFieldEditor({
  seat,
  field,
  value,
  playerCount,
  onChange,
}: TrackedFieldEditorProps) {
  const label = `${seat} 號 · ${field.label}`
  const seats = Array.from({ length: playerCount }, (_, index) => index + 1)

  switch (field.type) {
    case 'boolean': {
      const current = typeof value === 'boolean' ? value : field.initial
      return (
        <div className="field">
          <span className="field__label">{field.label}</span>
          <button
            type="button"
            className={`toggle-field${current ? ' is-on' : ''}`}
            aria-label={label}
            aria-pressed={current}
            onClick={() => onChange(!current)}
          >
            {current ? '是' : '否'}
          </button>
        </div>
      )
    }
    case 'seat': {
      const current = typeof value === 'number' ? value : null
      return (
        <label className="field">
          <span className="field__label">{field.label}</span>
          <select
            className="field-select"
            aria-label={label}
            value={current ?? ''}
            onChange={(event) =>
              onChange(event.target.value === '' ? null : Number(event.target.value))
            }
          >
            <option value="">—</option>
            {seats.map((entry) => (
              <option key={entry} value={entry}>
                {entry} 號
              </option>
            ))}
          </select>
        </label>
      )
    }
    case 'seatList': {
      const current = Array.isArray(value)
        ? value.filter((entry): entry is number => typeof entry === 'number')
        : []
      return (
        <div className="field">
          <span className="field__label">{field.label}</span>
          <div className="seat-picker" role="group" aria-label={label}>
            {seats.map((entry) => {
              const on = current.includes(entry)
              return (
                <button
                  type="button"
                  key={entry}
                  className={`seat-chip${on ? ' is-on' : ''}`}
                  aria-label={`${label} ${entry} 號`}
                  aria-pressed={on}
                  onClick={() =>
                    onChange(
                      on
                        ? current.filter((item) => item !== entry)
                        : [...current, entry].sort((a, b) => a - b),
                    )
                  }
                >
                  {entry}
                </button>
              )
            })}
          </div>
        </div>
      )
    }
    case 'roleId': {
      const current = typeof value === 'string' ? value : null
      return (
        <label className="field">
          <span className="field__label">{field.label}</span>
          <select
            className="field-select"
            aria-label={label}
            value={current ?? ''}
            onChange={(event) =>
              onChange(event.target.value === '' ? null : event.target.value)
            }
          >
            <option value="">—</option>
            {roles.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
        </label>
      )
    }
    case 'counter': {
      const current = typeof value === 'number' ? value : field.initial
      return (
        <div className="field">
          <span className="field__label">{field.label}</span>
          <div className="counter-row">
            <button
              type="button"
              aria-label={`${label} 減少`}
              disabled={current <= field.min}
              onClick={() => onChange(Math.max(field.min, current - 1))}
            >
              −
            </button>
            <strong>{current}</strong>
            <button
              type="button"
              aria-label={`${label} 增加`}
              disabled={current >= field.max}
              onClick={() => onChange(Math.min(field.max, current + 1))}
            >
              ＋
            </button>
          </div>
        </div>
      )
    }
    case 'enum': {
      const current = typeof value === 'string' ? value : null
      return (
        <label className="field">
          <span className="field__label">{field.label}</span>
          <select
            className="field-select"
            aria-label={label}
            value={current ?? ''}
            onChange={(event) =>
              onChange(event.target.value === '' ? null : event.target.value)
            }
          >
            <option value="">—</option>
            {field.values.map((entry) => (
              <option key={entry} value={entry}>
                {formatTrackedValue(field, entry)}
              </option>
            ))}
          </select>
        </label>
      )
    }
    case 'seatPairList': {
      const current = Array.isArray(value)
        ? (value as [number, number][])
        : field.initial
      return (
        <div className="field">
          <span className="field__label">{field.label}</span>
          {current.map((pair, index) => (
            <div className="pair-row" key={index}>
              <select
                className="field-select"
                aria-label={`${label} 第 ${index + 1} 組座位一`}
                value={pair[0]}
                onChange={(event) =>
                  onChange(
                    current.map((entry, entryIndex): [number, number] =>
                      entryIndex === index
                        ? [Number(event.target.value), entry[1]]
                        : entry,
                    ),
                  )
                }
              >
                {seats.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry} 號
                  </option>
                ))}
              </select>
              <select
                className="field-select"
                aria-label={`${label} 第 ${index + 1} 組座位二`}
                value={pair[1]}
                onChange={(event) =>
                  onChange(
                    current.map((entry, entryIndex): [number, number] =>
                      entryIndex === index
                        ? [entry[0], Number(event.target.value)]
                        : entry,
                    ),
                  )
                }
              >
                {seats.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry} 號
                  </option>
                ))}
              </select>
              <button
                type="button"
                aria-label={`${label} 移除第 ${index + 1} 組`}
                onClick={() =>
                  onChange(current.filter((_, entryIndex) => entryIndex !== index))
                }
              >
                ×
              </button>
            </div>
          ))}
          <button
            type="button"
            className="ghost-btn"
            aria-label={`${label} 新增組合`}
            onClick={() => onChange([...current, [seats[0] ?? 1, seats[0] ?? 1]])}
          >
            新增組合
          </button>
        </div>
      )
    }
  }
}

interface EventLogSheetProps {
  setup: Setup
  history: DerivedGame['history']
  currentCycle: number
  onClose: () => void
}

function EventLogSheet({
  setup,
  history,
  currentCycle,
  onClose,
}: EventLogSheetProps) {
  const cycles = logCycles(history, currentCycle)
  const [selectedCycle, setSelectedCycle] = useState(currentCycle)
  const selected = cycles.find((cycle) => cycle.cycle === selectedCycle) ?? cycles[0]
  const total = countActionEvents(history)

  return (
    <section
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label="事件記錄"
    >
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <h2>事件記錄</h2>
        <button
          type="button"
          className="sheet-close"
          aria-label="關閉"
          autoFocus
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="sheet-body">
        <p className="sheet-note">
          共 {total} 筆 · 最新在上 · 復原請用底部按鈕
        </p>
        <div className="log-tabs" role="tablist" aria-label="日夜分類">
          {cycles.map(({ cycle }) => {
            const on = cycle === selected?.cycle
            return (
              <button
                type="button"
                role="tab"
                key={cycle}
                className={`log-tab${on ? ' is-on' : ''}`}
                aria-selected={on}
                onClick={() => setSelectedCycle(cycle)}
              >
                {cycleTabLabel(cycle)}
              </button>
            )
          })}
        </div>
        <ol className="log-list">
          {selected?.rows.map((row, index) =>
            row.event.type === 'phase' ? (
              <li className="log-entry log-entry--phase" key={index}>
                <span className="log-entry__marker">
                  {phaseMarkerLabel(row.event)}
                </span>
              </li>
            ) : (
              <li className="log-entry" key={index}>
                <span className="log-entry__no">
                  {String(row.number ?? 0).padStart(2, '0')}
                </span>
                <span className="log-entry__text">
                  {describeEvent(row.event, setup)}
                </span>
                <span className="log-entry__meta">
                  <i className="log-entry__phase">
                    {row.phase === 'night' ? '夜晚' : '白天'}
                  </i>
                  <span className="log-entry__kind">
                    {eventKindLabel(row.event)}
                  </span>
                </span>
              </li>
            ),
          )}
        </ol>
      </div>
    </section>
  )
}

interface UndoPeekSheetProps {
  onConfirm: () => void
  onClose: () => void
}

function UndoPeekSheet({ onConfirm, onClose }: UndoPeekSheetProps) {
  return (
    <section
      className="sheet"
      role="alertdialog"
      aria-modal="true"
      aria-label="復原查驗"
    >
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <h2>復原這次查驗？</h2>
        <button
          type="button"
          className="sheet-close"
          aria-label="關閉"
          autoFocus
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="sheet-body">
        <p className="sheet-note">
          復原只會移除查驗紀錄，不會讓玩家忘記已經看到的結果。
        </p>
        <div className="confirm-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            仍要復原
          </button>
        </div>
      </div>
    </section>
  )
}

interface ClearSheetProps {
  onConfirm: () => void
  onClose: () => void
}

function ClearSheet({ onConfirm, onClose }: ClearSheetProps) {
  return (
    <section
      className="sheet"
      role="alertdialog"
      aria-modal="true"
      aria-label="清除這一局"
    >
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <h2>清除這一局？</h2>
        <button
          type="button"
          className="sheet-close"
          aria-label="關閉"
          autoFocus
          onClick={onClose}
        >
          ×
        </button>
      </header>
      <div className="sheet-body">
        <p className="sheet-note">
          這一局與所有事件記錄會立刻清除，無法復原。清除後回到開局設定。
        </p>
        <div className="confirm-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            清除遊戲
          </button>
        </div>
      </div>
    </section>
  )
}
