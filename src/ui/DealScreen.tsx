import { useState } from 'react'
import { getRole } from '../data/catalog'
import type { DraftState } from '../game/state'
import type { NotebookDispatch } from '../game/useNotebook'
import { shuffleAssignments } from './roster'

interface DealScreenProps {
  draft: DraftState
  dispatch: NotebookDispatch
  onBack: () => void
}

export default function DealScreen({
  draft,
  dispatch,
  onBack,
}: DealScreenProps) {
  const [revealSeat, setRevealSeat] = useState<number | null>(null)
  const [swapPick, setSwapPick] = useState<number | null>(null)

  const revealed = new Set(draft.revealedSeats)
  const revealedCount = revealed.size
  const locked = revealedCount > 0
  const allRevealed =
    draft.playerCount > 0 && revealedCount === draft.playerCount
  const reviewRoles = !locked
  const activeRole = revealSeat === null
    ? null
    : getRole(draft.assignments[revealSeat - 1] ?? '') ?? null

  function leave() {
    setRevealSeat(null)
    setSwapPick(null)
    onBack()
  }

  function openSeat(seat: number) {
    if (swapPick !== null) {
      if (swapPick !== seat) {
        dispatch({ type: 'draft/swapSeats', a: swapPick, b: seat })
      }
      setSwapPick(null)
      return
    }
    setRevealSeat(seat)
  }

  function pickSwap(seat: number) {
    if (locked) {
      return
    }
    if (swapPick !== null) {
      if (swapPick !== seat) {
        dispatch({ type: 'draft/swapSeats', a: swapPick, b: seat })
      }
      setSwapPick(null)
      return
    }
    setSwapPick(seat)
  }

  function shuffle() {
    if (locked) {
      return
    }
    dispatch({
      type: 'draft/setAssignments',
      assignments: shuffleAssignments(draft.assignments as string[]),
    })
    setSwapPick(null)
  }

  function finishReveal() {
    if (revealSeat !== null) {
      dispatch({ type: 'draft/setReveal', seat: revealSeat, revealed: true })
    }
    setRevealSeat(null)
  }

  function startGame() {
    if (allRevealed) {
      dispatch({ type: 'game/start' })
    }
  }

  return (
    <main className="shell deal">
      <header className="app-head">
        <p className="brand">
          法官筆記<span className="brand__tag">單機</span>
        </p>
        <button type="button" className="text-button" onClick={leave}>
          返回設定
        </button>
      </header>

      <section className="deal-intro">
        <p className="eyebrow">DEAL · 數位發牌</p>
        <h1 className="title title--small">逐座出示角色</h1>
        <p className="lede">
          法官持有裝置。點一個座位出示角色，給該座位看完後按完成收起。
        </p>
        <div
          className="progress"
          role="progressbar"
          aria-label="出示進度"
          aria-valuemin={0}
          aria-valuemax={draft.playerCount}
          aria-valuenow={revealedCount}
        >
          <div
            className="progress__bar"
            style={{
              width: `${
                draft.playerCount > 0
                  ? Math.round((revealedCount / draft.playerCount) * 100)
                  : 0
              }%`,
            }}
          />
        </div>
        <div className="progress__labels">
          <span>
            已出示 {revealedCount} / {draft.playerCount}
          </span>
          <span>{locked ? '已鎖定角色' : '可交換或重新洗牌'}</span>
        </div>
      </section>

      {swapPick !== null ? (
        <div className="swap-banner" role="status">
          再點一個座位交換角色
          <button
            type="button"
            className="text-button"
            onClick={() => setSwapPick(null)}
          >
            取消
          </button>
        </div>
      ) : null}

      <div className="deal-list">
        {draft.assignments.map((roleId, index) => {
          const seat = index + 1
          const role = getRole(roleId ?? '')
          if (!role) {
            return null
          }
          const isRevealed = revealed.has(seat)
          const showRole = isRevealed || reviewRoles
          return (
            <div
              className={`deal-row${isRevealed ? ' is-revealed' : ''}${
                swapPick === seat ? ' is-picked' : ''
              }`}
              key={seat}
            >
              <button
                type="button"
                className="deal-row__main"
                aria-label={`座位 ${seat}`}
                onClick={() => openSeat(seat)}
              >
                <span className="deal-row__num">{seat}</span>
                <span className="deal-row__body">
                  <span className="deal-row__role">
                    {showRole ? role.name : '未出示'}
                  </span>
                  <span className="deal-row__meta">
                    {isRevealed
                      ? `${role.camp} · 已出示`
                      : showRole
                        ? `${role.camp} · 未出示`
                        : '點一下向該座位出示'}
                  </span>
                </span>
                {isRevealed ? (
                  <span className="deal-row__check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                className={`deal-row__swap${swapPick === seat ? ' is-on' : ''}`}
                aria-label={`交換座位 ${seat}`}
                disabled={locked}
                onClick={() => pickSwap(seat)}
              >
                交換
              </button>
            </div>
          )
        })}
      </div>

      <div className="deal-actions">
        <button type="button" disabled={locked} onClick={shuffle}>
          重新洗牌
        </button>
        <button
          type="button"
          className="primary primary--inline"
          disabled={!allRevealed}
          onClick={startGame}
        >
          開始遊戲
        </button>
      </div>
      <p className="fine">
        所有座位出示完畢後才能開始。交換或洗牌在第一次出示後鎖定。
      </p>

      {revealSeat !== null && activeRole ? (
        <div
          className="judge-reveal"
          role="dialog"
          aria-modal="true"
          aria-label={`座位 ${revealSeat} 角色`}
        >
          <p className="judge-reveal__kicker">
            數位發牌 · 只給 {revealSeat} 號看
          </p>
          <p className="judge-reveal__camp">{activeRole.camp}</p>
          <h1>{activeRole.name}</h1>
          <button type="button" autoFocus onClick={finishReveal}>
            完成
          </button>
          <button
            type="button"
            className="judge-reveal__back"
            onClick={() => setRevealSeat(null)}
          >
            取消出示
          </button>
        </div>
      ) : null}
    </main>
  )
}
