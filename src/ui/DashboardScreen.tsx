import { useEffect, useState } from 'react'
import {
  getRole,
  presetBoardsById,
  roles,
  type Role,
  type TrackedField,
  type TrackedFieldValue,
} from '../data/catalog'
import {
  ELIMINATION_REASON_LABELS,
  ELIMINATION_REASONS,
  TABLE_STATES,
  deriveGame,
  type DerivedGame,
  type EliminationReason,
  type NotebookState,
  type Setup,
  type TableStateId,
} from '../game/state'
import type { NotebookDispatch } from '../game/useNotebook'
import {
  describeEvent,
  eventKindLabel,
  formatSeats,
  formatTrackedValue,
  groupRoles,
  peekKindLabel,
  trackedSummary,
  type RoleHolder,
} from './dashboard'
import PeekFlow from './PeekFlow'

interface DashboardScreenProps {
  state: NotebookState
  dispatch: NotebookDispatch
  onClear: () => void
}

type OpenSheet =
  | { kind: 'role'; roleId: string }
  | { kind: 'seat'; seat: number }
  | { kind: 'log' }
  | { kind: 'peek' }
  | { kind: 'undoPeek' }
  | { kind: 'clear' }
  | null

export default function DashboardScreen({
  state,
  dispatch,
  onClear,
}: DashboardScreenProps) {
  const [sheet, setSheet] = useState<OpenSheet>(null)
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
  const lastEvent = game.history[game.history.length - 1]
  const outBySeat = new Map(game.outPlayers.map((player) => [player.seat, player.reason]))
  const roleGroups = groupRoles(game)
  const openRole =
    sheet?.kind === 'role' ? getRole(sheet.roleId) ?? null : null
  const openRoleHolders = openRole
    ? roleGroups.find((group) => group.role.id === openRole.id)?.holders ?? []
    : []

  function setUsed(seat: number, used: boolean) {
    dispatch({ type: 'game/append', event: { type: 'used', seat, used } })
  }

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

      <section aria-label="角色列表">
        <h2 className="field-label">角色</h2>
        <div className="role-list">
          {roleGroups.map(({ role, holders }) => (
            <div className="role-row" key={role.id}>
              <div className="role-row__head">
                <button
                  type="button"
                  className="role-row__name"
                  aria-label={`${role.name} 角色詳情`}
                  onClick={() => setSheet({ kind: 'role', roleId: role.id })}
                >
                  <span>
                    {role.name}
                    {holders.length > 1 ? ` ×${holders.length}` : ''}
                  </span>
                  <small>{role.camp}</small>
                </button>
                <div className="role-row__seats">
                  {holders.map((holder) => (
                    <button
                      type="button"
                      key={holder.seat}
                      className={`role-seat${holder.used ? ' is-used' : ''}`}
                      aria-label={`座位 ${holder.seat} 已使用`}
                      aria-pressed={holder.used}
                      onClick={() => setUsed(holder.seat, !holder.used)}
                    >
                      {holder.seat} 號 · {holder.used ? '已用' : '未用'}
                    </button>
                  ))}
                </div>
              </div>
              {holders.map((holder) => {
                const lines = trackedSummary(role, game.roleStateBySeat[holder.seat])
                if (lines.length === 0) {
                  return null
                }
                return (
                  <p className="role-row__state" key={`state-${holder.seat}`}>
                    <b>{holder.seat} 號</b>
                    {lines.join(' · ')}
                  </p>
                )
              })}
            </div>
          ))}
        </div>
      </section>

      <section aria-label="座位一覽">
        <h2 className="field-label field-label--spaced">座位</h2>
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
        <p className="sheet-note">點座位可設定場上狀態與出局。</p>
      </section>

      <nav className="dash-dock" aria-label="法官操作">
        <button
          type="button"
          className="dash-dock__peek"
          aria-label="查驗"
          onClick={() => setSheet({ kind: 'peek' })}
        >
          查驗
        </button>
        <button
          type="button"
          aria-label="事件記錄"
          onClick={() => setSheet({ kind: 'log' })}
        >
          事件 <span className="dash-dock__count">{game.history.length}</span>
        </button>
        <button type="button" aria-label="復原上一步" onClick={requestUndo}>
          復原
        </button>
      </nav>

      {sheet && sheet.kind !== 'peek' ? (
        <div
          className="sheet-backdrop"
          aria-hidden="true"
          onClick={() => setSheet(null)}
        />
      ) : null}

      {openRole ? (
        <RoleSheet
          role={openRole}
          holders={openRoleHolders}
          game={game}
          dispatch={dispatch}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === 'seat' ? (
        <SeatSheet
          seat={sheet.seat}
          game={game}
          dispatch={dispatch}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === 'log' ? (
        <EventLogSheet
          setup={game.setup}
          history={game.history}
          onUndo={requestUndo}
          onClose={() => setSheet(null)}
        />
      ) : null}

      {sheet?.kind === 'peek' ? (
        <PeekFlow
          game={game}
          dispatch={dispatch}
          onClose={() => setSheet(null)}
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
  onClose: () => void
}

function SeatSheet({ seat, game, dispatch, onClose }: SeatSheetProps) {
  const role = getRole(game.seatRoles[seat] ?? '')
  const out = game.outPlayers.find((player) => player.seat === seat)

  function toggleTableState(state: TableStateId, active: boolean) {
    const seats = active
      ? [...game.tableStates[state], seat].sort((a, b) => a - b)
      : game.tableStates[state].filter((entry) => entry !== seat)
    dispatch({ type: 'game/append', event: { type: 'tableState', state, seats } })
  }

  function eliminate(reason: EliminationReason) {
    dispatch({ type: 'game/append', event: { type: 'elimination', seat, reason } })
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

        {out ? (
          <div className="out-banner" role="status">
            <span className="out-banner__label">已出局</span>
            <strong>{ELIMINATION_REASON_LABELS[out.reason]}</strong>
            <p className="sheet-note">
              復原只移除最後一筆事件；若要更正較早的紀錄，需先復原它之後的事件。
            </p>
          </div>
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

interface RoleSheetProps {
  role: Role
  holders: readonly RoleHolder[]
  game: DerivedGame
  dispatch: NotebookDispatch
  onClose: () => void
}

function RoleSheet({ role, holders, game, dispatch, onClose }: RoleSheetProps) {
  function setUsed(seat: number, used: boolean) {
    dispatch({ type: 'game/append', event: { type: 'used', seat, used } })
  }

  function updateField(seat: number, field: TrackedField, value: TrackedFieldValue) {
    dispatch({
      type: 'game/append',
      event: { type: 'roleState', seat, field: field.key, value },
    })
  }

  return (
    <section
      className="sheet"
      role="dialog"
      aria-modal="true"
      aria-label={`${role.name} 角色詳情`}
    >
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <h2>{role.name}</h2>
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
            className={`camp-dot camp-dot--${role.campKey}`}
            aria-hidden="true"
          />
          {role.camp}
        </p>
        <p className="sheet-ability">{role.ability}</p>
        {role.peekNote ? <p className="sheet-note">{role.peekNote}</p> : null}
        <dl className="sheet-facts">
          <div>
            <dt>查驗方式</dt>
            <dd>{peekKindLabel(role.peekKind)}</dd>
          </div>
          <div>
            <dt>在場座位</dt>
            <dd>{formatSeats(holders.map((holder) => holder.seat))}</dd>
          </div>
        </dl>

        {holders.map((holder) => {
          const roleState = game.roleStateBySeat[holder.seat]
          return (
            <section className="holder" key={holder.seat}>
              <header className="holder__head">
                <h3>{holder.seat} 號</h3>
                <button
                  type="button"
                  className={`used-toggle${holder.used ? ' is-on' : ''}`}
                  aria-label={`座位 ${holder.seat} 已使用`}
                  aria-pressed={holder.used}
                  onClick={() => setUsed(holder.seat, !holder.used)}
                >
                  {holder.used ? '已使用 · 點擊取消' : '標記為已使用'}
                </button>
              </header>
              {role.trackedFields.length === 0 ? (
                <p className="sheet-note">此角色沒有追蹤欄位。</p>
              ) : (
                role.trackedFields.map((field) => (
                  <TrackedFieldEditor
                    key={field.key}
                    seat={holder.seat}
                    field={field}
                    value={roleState?.[field.key]}
                    playerCount={game.setup.playerCount}
                    onChange={(value) => updateField(holder.seat, field, value)}
                  />
                ))
              )}
            </section>
          )
        })}
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
  onUndo: () => void
  onClose: () => void
}

function EventLogSheet({ setup, history, onUndo, onClose }: EventLogSheetProps) {
  const entries = history
    .map((event, index) => ({ event, index }))
    .reverse()

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
        <p className="sheet-note">共 {history.length} 筆 · 復原只移除最後一筆</p>
        <ol className="log-list">
          {entries.map(({ event, index }) => (
            <li className="log-entry" key={index}>
              <span className="log-entry__no">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="log-entry__text">
                {describeEvent(event, setup)}
              </span>
              <span className="log-entry__kind">{eventKindLabel(event)}</span>
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="ghost-btn ghost-btn--danger"
          aria-label="復原上一步"
          disabled={history.length === 0}
          onClick={onUndo}
        >
          復原上一步
        </button>
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
