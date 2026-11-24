import { useEffect, useState } from 'react'
import { getRole, presetBoardsById } from '../data/catalog'
import type { ActiveGame, Setup } from '../game/state'
import RoleOptions from './RoleOptions'

interface DashboardScreenProps {
  game: ActiveGame
  onToggleOut: (seat: number) => void
  onSetRole: (seat: number, roleId: string | null) => void
  onSetCopiedTarget: (seat: number, target: number | null) => void
  onReset: () => void
}

export default function DashboardScreen({
  game,
  onToggleOut,
  onSetRole,
  onSetCopiedTarget,
  onReset,
}: DashboardScreenProps) {
  const [confirmingReset, setConfirmingReset] = useState(false)
  const [openSeatNumber, setOpenSeatNumber] = useState<number | null>(null)
  const alive = game.seats.filter((seat) => !seat.out).length

  useEffect(() => {
    if (!confirmingReset && openSeatNumber === null) {
      return
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setConfirmingReset(false)
        setOpenSeatNumber(null)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmingReset, openSeatNumber])

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
                  {seat.copiedTarget !== null ? (
                    <span className="game-seat__tags">
                      <i className="tag--copied">
                        模仿 {seat.copiedTarget} 號 ·{' '}
                        {copiedRole?.name ?? '未指定'}
                      </i>
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
    </main>
  )
}

interface SeatSheetProps {
  game: ActiveGame
  seatNumber: number
  onSetRole: (seat: number, roleId: string | null) => void
  onSetCopiedTarget: (seat: number, target: number | null) => void
  onClose: () => void
}

function SeatSheet({
  game,
  seatNumber,
  onSetRole,
  onSetCopiedTarget,
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
        </div>
      </section>
    </>
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
