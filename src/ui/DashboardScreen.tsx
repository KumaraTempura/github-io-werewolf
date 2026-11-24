import { useEffect, useState } from 'react'
import { getRole, presetBoardsById, type Role } from '../data/catalog'
import {
  TABLE_STATES,
  USED_FLAGS,
  type ActiveGame,
  type Setup,
  type TableStateId,
  type UsedFlagId,
} from '../game/state'
import RoleOptions from './RoleOptions'

const REVEAL_LABELS = {
  role: '顯示角色',
  good: '顯示好人',
  wolf: '顯示狼人',
} as const

type RevealKind = keyof typeof REVEAL_LABELS

const REVEAL_KINDS = Object.keys(REVEAL_LABELS) as RevealKind[]

const REVEAL_RESULTS: Partial<Record<RevealKind, string>> = {
  good: '好人',
  wolf: '狼人',
}

interface ActiveReveal {
  seat: number
  kind: RevealKind
}

interface DashboardScreenProps {
  game: ActiveGame
  onToggleOut: (seat: number) => void
  onSetRole: (seat: number, roleId: string | null) => void
  onSetCopiedTarget: (seat: number, target: number | null) => void
  onToggleUsedFlag: (seat: number, flag: UsedFlagId) => void
  onToggleTableState: (seat: number, tableState: TableStateId) => void
  onReset: () => void
}

export default function DashboardScreen({
  game,
  onToggleOut,
  onSetRole,
  onSetCopiedTarget,
  onToggleUsedFlag,
  onToggleTableState,
  onReset,
}: DashboardScreenProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [openSeatNumber, setOpenSeatNumber] = useState<number | null>(null)
  const [reveal, setReveal] = useState<ActiveReveal | null>(null)
  const alive = game.seats.filter((seat) => !seat.out).length

  useEffect(() => {
    if (!confirmingReset && openSeatNumber === null && reveal === null) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setConfirmingReset(false)
        setOpenSeatNumber(null)
        setReveal(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmingReset, openSeatNumber, reveal])

  return (
    <main className="shell game">
      <header className="app-head">
        <p className="brand">
          法官筆記<span className="brand__tag">單機</span>
        </p>
        <button
          type="button"
          className="text-button"
          onClick={() => setConfirmingReset(true)}
        >
          重設這一局
        </button>
      </header>

      <header className="game-head">
        <div>
          <p className="eyebrow">
            JUDGE · {game.setup.mode === 'digital' ? '數位發牌' : '實體發牌'}
          </p>
          <h1 className="title title--small">{boardTitle(game.setup)}</h1>
        </div>
        <p className="game-head__alive">
          <strong>{alive}</strong>
          <span> / {game.setup.playerCount} 在場</span>
        </p>
      </header>

      <section aria-label="座位一覽">
        <h2 className="field-label">座位</h2>
        <div className="game-grid">
          {game.seats.map((seat, index) => {
            const seatNumber = index + 1
            const role = getRole(seat.roleId ?? '')
            const copiedRole =
              seat.copiedTarget === null
                ? undefined
                : getRole(
                    game.seats[seat.copiedTarget - 1]?.roleId ?? '',
                  )
            const tags = [
              ...USED_FLAGS.filter((flag) => seat.usedFlags[flag.id]).map(
                (flag) => ({
                  key: flag.id,
                  label: flag.label,
                  className: 'tag--used',
                }),
              ),
              ...TABLE_STATES.filter(
                (tableState) => seat.tableStates[tableState.id],
              ).map((tableState) => ({
                key: tableState.id,
                label: tableState.label,
                className: 'tag--state',
              })),
              ...(seat.copiedTarget === null
                ? []
                : [
                    {
                      key: 'copied',
                      label: `模仿 ${seat.copiedTarget} 號 · ${
                        copiedRole?.name ?? '未指定'
                      }`,
                      className: 'tag--copied',
                    },
                  ]),
            ]
            return (
              <article
                className={`game-seat${seat.out ? ' is-out' : ''}`}
                key={seatNumber}
                aria-label={`座位 ${seatNumber}`}
              >
                <button
                  type="button"
                  className="game-seat__open"
                  aria-label={`座位 ${seatNumber} 詳情`}
                  onClick={() => setOpenSeatNumber(seatNumber)}
                >
                  <span className="game-seat__top">
                    <span className="game-seat__num">{seatNumber}</span>
                    {role ? (
                      <span
                        className={`camp-dot camp-dot--${role.campKey}`}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <span className="game-seat__role">{role?.name ?? '—'}</span>
                  <span className="game-seat__camp">{role?.camp ?? '—'}</span>
                  {tags.length > 0 ? (
                    <span className="game-seat__tags">
                      {tags.map((tag) => (
                        <i className={tag.className} key={tag.key}>
                          {tag.label}
                        </i>
                      ))}
                    </span>
                  ) : null}
                  {seat.out ? (
                    <span className="game-seat__out-marker">已出局</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={`game-seat__out-toggle${seat.out ? ' is-on' : ''}`}
                  aria-label={`座位 ${seatNumber} 出局`}
                  aria-pressed={seat.out}
                  onClick={() => onToggleOut(seatNumber)}
                >
                  出局
                </button>
                <div className="game-seat__reveals">
                  {REVEAL_KINDS.map((kind) => (
                    <button
                      type="button"
                      key={kind}
                      aria-label={`座位 ${seatNumber} ${REVEAL_LABELS[kind]}`}
                      disabled={kind === 'role' && !role}
                      onClick={() => setReveal({ seat: seatNumber, kind })}
                    >
                      {REVEAL_LABELS[kind]}
                    </button>
                  ))}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      {openSeatNumber !== null ? (
        <SeatSheet
          game={game}
          seatNumber={openSeatNumber}
          onSetRole={onSetRole}
          onSetCopiedTarget={onSetCopiedTarget}
          onToggleUsedFlag={onToggleUsedFlag}
          onToggleTableState={onToggleTableState}
          onClose={() => setOpenSeatNumber(null)}
        />
      ) : null}

      {confirmingReset ? (
        <ResetSheet
          onConfirm={() => {
            setConfirmingReset(false)
            onReset()
          }}
          onClose={() => setConfirmingReset(false)}
        />
      ) : null}

      {reveal !== null ? (
        <RevealScreen
          seat={reveal.seat}
          kind={reveal.kind}
          role={
            reveal.kind === 'role'
              ? getRole(game.seats[reveal.seat - 1]?.roleId ?? '')
              : undefined
          }
          onDismiss={() => setReveal(null)}
        />
      ) : null}
    </main>
  )
}

interface RevealScreenProps {
  seat: number
  kind: RevealKind
  role: Role | undefined
  onDismiss: () => void
}

function RevealScreen({ seat, kind, role, onDismiss }: RevealScreenProps) {
  const label = REVEAL_LABELS[kind]
  const result = REVEAL_RESULTS[kind] ?? role?.name
  if (!result) {
    return null
  }
  return (
    <div
      className="judge-reveal"
      role="dialog"
      aria-modal="true"
      aria-label={`座位 ${seat} ${label}`}
      onClick={onDismiss}
    >
      <p className="judge-reveal__kicker">
        座位 {seat} · {label}
      </p>
      {role ? <p className="judge-reveal__camp">{role.camp}</p> : null}
      <h1>{result}</h1>
      <button type="button" autoFocus onClick={onDismiss}>
        收起
      </button>
    </div>
  )
}

interface SeatSheetProps {
  game: ActiveGame
  seatNumber: number
  onSetRole: (seat: number, roleId: string | null) => void
  onSetCopiedTarget: (seat: number, target: number | null) => void
  onToggleUsedFlag: (seat: number, flag: UsedFlagId) => void
  onToggleTableState: (seat: number, tableState: TableStateId) => void
  onClose: () => void
}

function SeatSheet({
  game,
  seatNumber,
  onSetRole,
  onSetCopiedTarget,
  onToggleUsedFlag,
  onToggleTableState,
  onClose,
}: SeatSheetProps) {
  const seat = game.seats[seatNumber - 1]
  return (
    <>
      <button
        type="button"
        className="sheet-backdrop"
        aria-label="關閉座位詳情"
        onClick={onClose}
      />
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`座位 ${seatNumber} 詳情`}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <h2>座位 {seatNumber}</h2>
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
          <label
            className="field-label"
            htmlFor={`seat-role-${seatNumber}`}
          >
            角色
          </label>
          <select
            id={`seat-role-${seatNumber}`}
            className="select"
            aria-label={`座位 ${seatNumber} 角色`}
            value={seat.roleId ?? ''}
            onChange={(event) =>
              onSetRole(
                seatNumber,
                event.target.value === '' ? null : event.target.value,
              )
            }
          >
            <option value="">未指定</option>
            <RoleOptions />
          </select>

          <label
            className="field-label field-label--spaced"
            htmlFor={`seat-copied-${seatNumber}`}
          >
            模仿對象
          </label>
          <select
            id={`seat-copied-${seatNumber}`}
            className="select"
            aria-label={`座位 ${seatNumber} 模仿對象`}
            value={seat.copiedTarget ?? ''}
            onChange={(event) =>
              onSetCopiedTarget(
                seatNumber,
                event.target.value === '' ? null : Number(event.target.value),
              )
            }
          >
            <option value="">未指定</option>
            {game.seats.map((other, index) => (
              <option key={index + 1} value={index + 1}>
                {index + 1} 號 ·{' '}
                {getRole(other.roleId ?? '')?.name ?? '未指定'}
              </option>
            ))}
          </select>

          <h3 className="field-label field-label--spaced">已用標記</h3>
          <CheckChipGroup
            legend="已用標記"
            label={`座位 ${seatNumber}`}
            options={USED_FLAGS}
            checked={seat.usedFlags}
            onToggle={(flag) => onToggleUsedFlag(seatNumber, flag)}
          />

          <h3 className="field-label field-label--spaced">場上狀態</h3>
          <CheckChipGroup
            legend="場上狀態"
            label={`座位 ${seatNumber}`}
            options={TABLE_STATES}
            checked={seat.tableStates}
            onToggle={(tableState) =>
              onToggleTableState(seatNumber, tableState)
            }
          />
        </div>
      </section>
    </>
  )
}

interface CheckOption<T extends string> {
  id: T
  label: string
}

interface CheckChipGroupProps<T extends string> {
  legend: string
  label: string
  options: readonly CheckOption<T>[]
  checked: Record<T, boolean>
  onToggle: (id: T) => void
}

function CheckChipGroup<T extends string>({
  legend,
  label,
  options,
  checked,
  onToggle,
}: CheckChipGroupProps<T>) {
  return (
    <div className="check-grid" role="group" aria-label={legend}>
      {options.map((option) => (
        <label className="check-chip" key={option.id}>
          <input
            type="checkbox"
            aria-label={`${label} ${option.label}`}
            checked={checked[option.id]}
            onChange={() => onToggle(option.id)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  )
}

function boardTitle(setup: Setup): string {
  if (setup.boardId === null) {
    return '自訂板子'
  }
  return presetBoardsById.get(setup.boardId)?.name ?? '自訂板子'
}

interface ResetSheetProps {
  onConfirm: () => void
  onClose: () => void
}

function ResetSheet({ onConfirm, onClose }: ResetSheetProps) {
  return (
    <section
      className="sheet"
      role="alertdialog"
      aria-modal="true"
      aria-label="重設這一局"
    >
      <div className="sheet-grip" aria-hidden="true" />
      <header className="sheet-head">
        <h2>重設這一局？</h2>
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
          這一局與草稿會立刻清除，無法復原。重設後回到開局設定。
        </p>
        <div className="confirm-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button type="button" className="danger" onClick={onConfirm}>
            重設遊戲
          </button>
        </div>
      </div>
    </section>
  )
}
