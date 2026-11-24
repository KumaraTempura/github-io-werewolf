import { presetBoardsById } from '../data/catalog'
import type { DraftState, GameMode } from '../game/state'
import type { NotebookDispatch } from '../game/useNotebook'
import {
  CAMP_GROUPS,
  CUSTOM_BOARD_ID,
  MAX_PLAYERS,
  MIN_PLAYERS,
  assignmentsComplete,
  expandPreset,
  presetSections,
  roleCounts,
  rolesForCamp,
  shuffleAssignments,
} from './roster'

interface SetupScreenProps {
  draft: DraftState
  dispatch: NotebookDispatch
  legacyDiscarded?: boolean
  onDeal: () => void
}

const PRESET_SECTIONS = presetSections()

function clampPlayerCount(count: number): number {
  return Math.min(MAX_PLAYERS, Math.max(MIN_PLAYERS, count))
}

export default function SetupScreen({
  draft,
  dispatch,
  legacyDiscarded = false,
  onDeal,
}: SetupScreenProps) {
  const board = draft.boardId ? presetBoardsById.get(draft.boardId) ?? null : null
  const complete = assignmentsComplete(draft.assignments, draft.playerCount)
  const showAssignmentGrid = board === null || draft.mode === 'physical'
  const counts = roleCounts(draft.assignments)

  function resetReveals() {
    for (const seat of draft.revealedSeats) {
      dispatch({ type: 'draft/setReveal', seat, revealed: false })
    }
  }

  function chooseBoard(value: string) {
    resetReveals()
    if (value === CUSTOM_BOARD_ID) {
      dispatch({ type: 'draft/setBoard', boardId: null })
      if (draft.playerCount < MIN_PLAYERS || draft.playerCount > MAX_PLAYERS) {
        const playerCount = clampPlayerCount(draft.playerCount || 9)
        dispatch({ type: 'draft/setPlayerCount', playerCount })
        dispatch({
          type: 'draft/setAssignments',
          assignments: Array.from({ length: playerCount }, () => null),
        })
      }
      return
    }
    const preset = presetBoardsById.get(value)
    if (!preset) {
      return
    }
    dispatch({ type: 'draft/setBoard', boardId: preset.id })
    dispatch({ type: 'draft/setPlayerCount', playerCount: preset.playerCount })
    dispatch({
      type: 'draft/setAssignments',
      assignments: expandPreset(preset),
    })
  }

  function changePlayerCount(delta: number) {
    const playerCount = clampPlayerCount(draft.playerCount + delta)
    if (playerCount !== draft.playerCount) {
      resetReveals()
      dispatch({ type: 'draft/setPlayerCount', playerCount })
    }
  }

  function chooseMode(mode: GameMode) {
    if (mode !== draft.mode) {
      resetReveals()
      dispatch({ type: 'draft/setMode', mode })
    }
  }

  function chooseRole(seat: number, roleId: string) {
    resetReveals()
    dispatch({
      type: 'draft/setAssignment',
      seat,
      roleId: roleId === '' ? null : roleId,
    })
  }

  function primaryAction() {
    if (!complete) {
      return
    }
    if (draft.mode === 'physical') {
      dispatch({ type: 'game/start' })
      return
    }
    if (draft.revealedSeats.length === 0) {
      dispatch({
        type: 'draft/setAssignments',
        assignments: shuffleAssignments(draft.assignments as string[]),
      })
    }
    onDeal()
  }

  return (
    <main className="shell">
      <header className="app-head">
        <p className="brand">
          法官筆記<span className="brand__tag">單機</span>
        </p>
        <p className="app-head__note">開局設定</p>
      </header>

      <section className="setup-intro">
        <p className="eyebrow">SETUP · 開局設定</p>
        <h1 className="title">把這一局記下來</h1>
        <p className="lede">
          單一裝置、法官操作。選板子與發牌方式，開始前都能修改。
        </p>
      </section>

      {legacyDiscarded ? (
        <p className="legacy-notice" role="status">
          舊局紀錄已因日夜分類清除。
        </p>
      ) : null}

      <section className="card" aria-label="開局設定">
        <label className="field-label" htmlFor="board">
          板子
        </label>
        <select
          id="board"
          className="select"
          value={draft.boardId ?? CUSTOM_BOARD_ID}
          onChange={(event) => chooseBoard(event.target.value)}
        >
          <option value={CUSTOM_BOARD_ID}>自訂板子</option>
          {PRESET_SECTIONS.map(({ section, boards }) => (
            <optgroup key={section} label={`${section} 區`}>
              {boards.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}（{preset.playerCount} 人）
                </option>
              ))}
            </optgroup>
          ))}
        </select>

        {board ? (
          <div className="preset-summary">
            <strong>{board.playerCount} 人</strong>
            <span>{board.name}</span>
          </div>
        ) : (
          <div className="count-row">
            <span>玩家人數</span>
            <div className="stepper">
              <button
                type="button"
                aria-label="減少人數"
                onClick={() => changePlayerCount(-1)}
              >
                −
              </button>
              <strong aria-live="polite">{draft.playerCount}</strong>
              <button
                type="button"
                aria-label="增加人數"
                onClick={() => changePlayerCount(1)}
              >
                ＋
              </button>
            </div>
          </div>
        )}

        <h2 className="field-label field-label--spaced">發牌方式</h2>
        <div className="segmented" role="group" aria-label="發牌方式">
          <button
            type="button"
            className={draft.mode === 'digital' ? 'is-on' : undefined}
            aria-pressed={draft.mode === 'digital'}
            onClick={() => chooseMode('digital')}
          >
            數位發牌
          </button>
          <button
            type="button"
            className={draft.mode === 'physical' ? 'is-on' : undefined}
            aria-pressed={draft.mode === 'physical'}
            onClick={() => chooseMode('physical')}
          >
            實體發牌
          </button>
        </div>
        <p className="hint">
          {draft.mode === 'digital'
            ? '由 App 洗牌，法官逐座出示角色後開始。'
            : '使用實體卡牌，法官逐座輸入角色後直接開始。'}
        </p>

        {showAssignmentGrid ? (
          <div className="assign">
            <h2 className="field-label field-label--spaced">座位角色</h2>
            <div className="assign-grid">
              {draft.assignments.map((roleId, index) => {
                const seat = index + 1
                return (
                  <label className="assign-row" key={seat}>
                    <span className="assign-row__seat">{seat}</span>
                    <select
                      className="assign-row__select"
                      aria-label={`座位 ${seat} 角色`}
                      value={roleId ?? ''}
                      onChange={(event) => chooseRole(seat, event.target.value)}
                    >
                      <option value="">選擇角色</option>
                      {CAMP_GROUPS.map(({ key, label }) => (
                        <optgroup key={key} label={label}>
                          {rolesForCamp(key).map((role) => (
                            <option key={role.id} value={role.id}>
                              {role.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </label>
                )
              })}
            </div>
          </div>
        ) : null}

        {counts.length > 0 ? (
          <div className="chips" aria-label="角色組成">
            {counts.map(({ role, count }) => (
              <span className={`chip chip--${role.campKey}`} key={role.id}>
                {role.name}
                {count > 1 ? ` ×${count}` : ''}
              </span>
            ))}
          </div>
        ) : null}

        <button
          type="button"
          className="primary"
          disabled={!complete}
          onClick={primaryAction}
        >
          {draft.mode === 'digital' ? '發牌（數位）' : '開始遊戲（實體）'}
        </button>
        <p className="fine">
          {complete
            ? '草稿在開始前都可修改。'
            : showAssignmentGrid
              ? '為每個座位選擇角色後才能開始。'
              : '正在準備板子。'}
        </p>
      </section>

      <footer className="foot">法官筆記 · 單機單裝置</footer>
    </main>
  )
}
