import { useState, type ReactNode } from 'react'
import { getRole, roles } from '../data/catalog'
import type { DerivedGame, PeekCamp, PeekResult } from '../game/state'
import type { NotebookDispatch } from '../game/useNotebook'
import { formatPeekResult, formatSeats } from './dashboard'
import {
  computeCatalogResult,
  exactRoleResultFor,
  hasEnoughTargets,
  initialPeekState,
  lastExiledSeat,
  planPeek,
  type PeekPlan,
} from './peek'

interface PeekFlowProps {
  game: DerivedGame
  dispatch: NotebookDispatch
  inspectorSeat: number
  onClose: () => void
}

type Step = 'target' | 'preview' | 'reveal'

export default function PeekFlow({
  game,
  dispatch,
  inspectorSeat,
  onClose,
}: PeekFlowProps) {
  const role = getRole(game.seatRoles[inspectorSeat] ?? '') ?? null
  const plan = planPeek(role)
  const start = initialPeekState(game, inspectorSeat)
  const [step, setStep] = useState<Step>(start?.step ?? 'target')
  const [targetSeats, setTargetSeats] = useState<number[]>(
    start?.targetSeats ?? [],
  )
  const [override, setOverride] = useState<PeekResult | null>(
    start?.override ?? null,
  )
  const [editing, setEditing] = useState(start?.editing ?? false)

  const catalogResult = computeCatalogResult(game, inspectorSeat, targetSeats)
  const result = override ?? catalogResult
  const seats = targetSeats.length > 0 ? targetSeats : [inspectorSeat]

  function resetChoices() {
    setOverride(null)
    setEditing(false)
  }

  function openPreview() {
    if (plan.mode === 'lastExile' && !catalogResult) {
      setOverride({ kind: 'lastExileCamp', camp: 'good' })
      setEditing(true)
    } else {
      resetChoices()
    }
    setStep('preview')
  }

  function toggleTarget(seat: number) {
    resetChoices()
    if (plan.mode === 'teammates') {
      setTargetSeats((seats) =>
        seats.includes(seat)
          ? seats.filter((entry) => entry !== seat)
          : [...seats, seat].sort((a, b) => a - b),
      )
      return
    }
    if (plan.mode === 'pair') {
      setTargetSeats((seats) => {
        if (seats.includes(seat)) {
          return seats.filter((entry) => entry !== seat)
        }
        if (seats.length < 2) {
          return [...seats, seat].sort((a, b) => a - b)
        }
        return [seats[1], seat].sort((a, b) => a - b)
      })
      return
    }
    setTargetSeats([seat])
  }

  function backFromPreview() {
    resetChoices()
    if (plan.mode === 'lastExile') {
      onClose()
      return
    }
    setStep('target')
  }

  function beginCustomResult() {
    setEditing(true)
    if (!override) {
      setOverride(
        result ?? exactRoleResultFor(game, targetSeats[0] ?? inspectorSeat),
      )
    }
  }

  function restoreCatalogResult() {
    setOverride(null)
    setEditing(false)
  }

  function chooseExactRole() {
    const target = targetSeats[0]
    if (target === undefined) {
      return
    }
    const exact = exactRoleResultFor(game, target)
    if (exact) {
      setOverride(exact)
      setEditing(false)
    }
  }

  function finish() {
    if (!result) {
      return
    }
    dispatch({
      type: 'game/append',
      event: {
        type: 'peek',
        inspectorSeat,
        targetSeat: seats[0],
        ...(seats.length > 1 ? { targetSeats: seats } : {}),
        result,
      },
    })
    onClose()
  }

  if (!start || !role) {
    return null
  }

  if (step === 'reveal' && result) {
    return (
      <PeekReveal
        roleName={role.name}
        inspectorSeat={inspectorSeat}
        targetSeats={seats}
        plan={plan}
        result={result}
        onFinish={finish}
        onCancel={onClose}
      />
    )
  }

  const allSeats = Array.from(
    { length: game.setup.playerCount },
    (_, index) => index + 1,
  )
  const outBySeat = new Map(
    game.outPlayers.map((player) => [player.seat, player.reason]),
  )

  if (step === 'target') {
    const label =
      plan.mode === 'teammates'
        ? '隊友座位'
        : plan.mode === 'pair'
          ? '查驗目標（選兩名）'
          : '查驗目標'
    const targetAria =
      plan.mode === 'teammates' ? '隊友座位' : '查驗座位'
    return (
      <Sheet
        title={
          plan.mode === 'teammates'
            ? '選擇要告知的隊友'
            : plan.mode === 'pair'
              ? '選擇兩名查驗目標'
              : '選擇查驗目標'
        }
        label="選擇查驗目標"
        onClose={onClose}
      >
        <p className="sheet-roleline">
          <span
            className={`camp-dot camp-dot--${role.campKey}`}
            aria-hidden="true"
          />
          {role.name} · {inspectorSeat} 號
        </p>
        <p className="sheet-note">
          {plan.mode === 'teammates'
            ? '可多選；出示時只會看到號碼。'
            : plan.mode === 'pair'
              ? '選兩個座位；結果會合併成好人或狼人。'
              : '選一個座位。'}
        </p>
        <p className="field-label">{label}</p>
        <div className="peek-seats">
          {allSeats.map((seat) => {
            const on = targetSeats.includes(seat)
            const out = outBySeat.get(seat)
            return (
              <button
                type="button"
                key={seat}
                className={`peek-seat${on ? ' is-on' : ''}${out ? ' is-out' : ''}`}
                aria-label={`${targetAria} ${seat}`}
                aria-pressed={on}
                onClick={() => toggleTarget(seat)}
              >
                <span>{seat}</span>
                {out ? <small>出局</small> : null}
              </button>
            )
          })}
        </div>
        <div className="confirm-actions">
          <button type="button" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="primary"
            disabled={!hasEnoughTargets(plan, targetSeats.length)}
            onClick={openPreview}
          >
            下一步
          </button>
        </div>
      </Sheet>
    )
  }

  const showExactOverride =
    !editing && result !== null && result.kind !== 'exactRole' && targetSeats.length === 1
  return (
    <Sheet title="查驗預覽" label="查驗預覽" onClose={onClose}>
      <p className="sheet-roleline">
        <span
          className={`camp-dot camp-dot--${role.campKey}`}
          aria-hidden="true"
        />
        {role.name} · 法官 {inspectorSeat} 號
      </p>
      <p className="sheet-note">
        {targetSummary(game, inspectorSeat, plan, targetSeats)}
      </p>
      <div className="peek-result">
        <span className="field-label">給 {inspectorSeat} 號看</span>
        <strong className="peek-result__value">
          {result ? formatPeekResult(result) : '—'}
        </strong>
      </div>
      {showExactOverride ? (
        <button type="button" className="ghost-btn" onClick={chooseExactRole}>
          顯示確切角色
        </button>
      ) : null}
      {!editing && override && catalogResult ? (
        <button
          type="button"
          className="text-button"
          onClick={restoreCatalogResult}
        >
          還原目錄結果
        </button>
      ) : null}
      {editing ? (
        <>
          <PeekResultEditor
            value={override}
            playerCount={game.setup.playerCount}
            fallbackRoleId={
              (targetSeats[0] !== undefined
                ? game.seatRoles[targetSeats[0]]
                : game.seatRoles[inspectorSeat]) ?? null
            }
            onChange={(next) => setOverride(next)}
          />
          {catalogResult ? (
            <button
              type="button"
              className="text-button"
              onClick={restoreCatalogResult}
            >
              還原目錄結果
            </button>
          ) : null}
        </>
      ) : (
        <button type="button" className="ghost-btn" onClick={beginCustomResult}>
          自訂結果
        </button>
      )}
      <div className="confirm-actions">
        <button type="button" onClick={backFromPreview}>
          上一步
        </button>
        <button
          type="button"
          className="primary"
          disabled={!result}
          onClick={() => setStep('reveal')}
        >
          出示給玩家
        </button>
      </div>
    </Sheet>
  )
}

function targetSummary(
  game: DerivedGame,
  inspectorSeat: number,
  plan: PeekPlan,
  targetSeats: readonly number[],
): string {
  if (plan.mode === 'teammates') {
    return targetSeats.length > 0
      ? `要告知的隊友：${formatSeats(targetSeats)}`
      : `法官 ${inspectorSeat} 號不告知任何隊友`
  }
  if (plan.mode === 'lastExile') {
    const exiled = lastExiledSeat(game)
    return exiled !== null
      ? `上一個被放逐：${exiled} 號`
      : '尚無放逐紀錄；請自行選擇要出示的陣營'
  }
  return `查驗目標：${targetSeats.length > 0 ? formatSeats(targetSeats) : '—'}`
}

interface SheetProps {
  title: string
  label: string
  onClose: () => void
  children: ReactNode
}

function Sheet({ title, label, onClose, children }: SheetProps) {
  return (
    <>
      <div
        className="sheet-backdrop"
        aria-hidden="true"
        onClick={onClose}
      />
      <section
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="sheet-grip" aria-hidden="true" />
        <header className="sheet-head">
          <h2>{title}</h2>
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
        <div className="sheet-body">{children}</div>
      </section>
    </>
  )
}

interface PeekResultEditorProps {
  value: PeekResult | null
  playerCount: number
  fallbackRoleId: string | null
  onChange: (result: PeekResult) => void
}

function PeekResultEditor({
  value,
  playerCount,
  fallbackRoleId,
  onChange,
}: PeekResultEditorProps) {
  const kind = value?.kind ?? 'exactRole'
  const seats = Array.from({ length: playerCount }, (_, index) => index + 1)

  function changeKind(next: PeekResult['kind']) {
    switch (next) {
      case 'exactRole':
        onChange({
          kind: 'exactRole',
          roleId:
            value?.kind === 'exactRole'
              ? value.roleId
              : fallbackRoleId ?? roles[0].id,
        })
        break
      case 'goodOrWolf':
        onChange({
          kind: 'goodOrWolf',
          camp: value?.kind === 'goodOrWolf' ? value.camp : 'good',
        })
        break
      case 'teammateNumber':
        onChange({
          kind: 'teammateNumber',
          seats: value?.kind === 'teammateNumber' ? value.seats : [],
        })
        break
      case 'lastExileCamp':
        onChange({
          kind: 'lastExileCamp',
          camp: value?.kind === 'lastExileCamp' ? value.camp : 'good',
        })
        break
    }
  }

  return (
    <div className="peek-editor">
      <label className="field">
        <span className="field__label">自訂結果類型</span>
        <select
          className="field-select"
          aria-label="自訂查驗結果類型"
          value={kind}
          onChange={(event) => changeKind(event.target.value as PeekResult['kind'])}
        >
          <option value="exactRole">確切角色</option>
          <option value="goodOrWolf">好人／狼人</option>
          <option value="teammateNumber">隊友號碼</option>
          <option value="lastExileCamp">上次放逐陣營</option>
        </select>
      </label>
      {value?.kind === 'exactRole' ? (
        <label className="field">
          <span className="field__label">角色</span>
          <select
            className="field-select"
            aria-label="自訂查驗角色"
            value={value.roleId}
            onChange={(event) =>
              onChange({ kind: 'exactRole', roleId: event.target.value })
            }
          >
            {roles.map((role) => (
              <option key={role.id} value={role.id}>
                {role.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {value?.kind === 'goodOrWolf' || value?.kind === 'lastExileCamp' ? (
        <CampPicker
          label="自訂查驗陣營"
          camp={value.camp}
          onChange={(camp) =>
            onChange(
              value.kind === 'goodOrWolf'
                ? { kind: 'goodOrWolf', camp }
                : { kind: 'lastExileCamp', camp },
            )
          }
        />
      ) : null}
      {value?.kind === 'teammateNumber' ? (
        <div className="field">
          <span className="field__label">隊友號碼</span>
          <div className="seat-picker" role="group" aria-label="自訂查驗隊友">
            {seats.map((seat) => {
              const on = value.seats.includes(seat)
              return (
                <button
                  type="button"
                  key={seat}
                  className={`seat-chip${on ? ' is-on' : ''}`}
                  aria-label={`自訂查驗隊友 ${seat}`}
                  aria-pressed={on}
                  onClick={() =>
                    onChange({
                      kind: 'teammateNumber',
                      seats: on
                        ? value.seats.filter((entry) => entry !== seat)
                        : [...value.seats, seat].sort((a, b) => a - b),
                    })
                  }
                >
                  {seat}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
    </div>
  )
}

interface CampPickerProps {
  label: string
  camp: PeekCamp
  onChange: (camp: PeekCamp) => void
}

function CampPicker({ label, camp, onChange }: CampPickerProps) {
  return (
    <div className="field">
      <span className="field__label">陣營</span>
      <div className="peek-camp" role="group" aria-label={label}>
        {(['good', 'wolf'] as const).map((entry) => (
          <button
            type="button"
            key={entry}
            className={`seat-chip${camp === entry ? ' is-on' : ''}`}
            aria-pressed={camp === entry}
            onClick={() => onChange(entry)}
          >
            {entry === 'good' ? '好人' : '狼人'}
          </button>
        ))}
      </div>
    </div>
  )
}

interface PeekRevealProps {
  roleName: string
  inspectorSeat: number
  targetSeats: readonly number[]
  plan: PeekPlan
  result: PeekResult
  onFinish: () => void
  onCancel: () => void
}

function PeekReveal({
  roleName,
  inspectorSeat,
  targetSeats,
  plan,
  result,
  onFinish,
  onCancel,
}: PeekRevealProps) {
  let kicker: string
  let headline: string
  if (result.kind === 'teammateNumber') {
    kicker = `狼隊友 · 只給 ${inspectorSeat} 號看`
    headline =
      result.seats.length > 0 ? `${result.seats.join('、')} 號` : '沒有隊友'
  } else if (result.kind === 'lastExileCamp') {
    kicker = `上一個被放逐的玩家 · 只給 ${inspectorSeat} 號看`
    headline = result.camp === 'wolf' ? '狼人' : '好人'
  } else if (result.kind === 'exactRole') {
    kicker =
      plan.mode === 'teammates'
        ? `${roleName} · 只給 ${inspectorSeat} 號看`
        : `${roleName}查驗 ${formatSeats(targetSeats)} · 只給 ${inspectorSeat} 號看`
    headline = getRole(result.roleId)?.name ?? result.roleId
  } else {
    kicker =
      plan.mode === 'teammates'
        ? `${roleName} · 只給 ${inspectorSeat} 號看`
        : `${roleName}查驗 ${formatSeats(targetSeats)} · 只給 ${inspectorSeat} 號看`
    headline = result.camp === 'wolf' ? '狼人' : '好人'
  }

  return (
    <div
      className="judge-reveal"
      role="dialog"
      aria-modal="true"
      aria-label="查驗結果"
    >
      <p className="judge-reveal__kicker">{kicker}</p>
      <h1>{headline}</h1>
      <button type="button" autoFocus onClick={onFinish}>
        完成
      </button>
      <button
        type="button"
        className="judge-reveal__back"
        onClick={onCancel}
      >
        取消
      </button>
    </div>
  )
}
