import { useEffect, useState } from 'react'
import { presetBoardsById } from './data/catalog'
import { isPlaying, type DraftState } from './game/state'
import { useNotebook } from './game/useNotebook'
import DashboardScreen from './ui/DashboardScreen'
import DealScreen from './ui/DealScreen'
import SetupScreen from './ui/SetupScreen'
import { expandPreset } from './ui/roster'

const DEFAULT_BOARD_ID = 'standard-333'

function initialScreen(draft: DraftState): 'setup' | 'deal' {
  return draft.mode === 'digital' && draft.revealedSeats.length > 0
    ? 'deal'
    : 'setup'
}

export default function App() {
  const [state, dispatch, legacyDiscarded] = useNotebook()
  const [showLegacyNotice, setShowLegacyNotice] = useState(legacyDiscarded)
  const [screen, setScreen] = useState<'setup' | 'deal'>(() =>
    initialScreen(state.draft),
  )

  useEffect(() => {
    if (isPlaying(state) || screen === 'deal') {
      setShowLegacyNotice(false)
    }
  }, [state, screen])

  useEffect(() => {
    if (isPlaying(state)) {
      return
    }
    const { draft } = state
    if (draft.boardId !== null || draft.playerCount !== 0) {
      return
    }
    const preset = presetBoardsById.get(DEFAULT_BOARD_ID)
    if (!preset) {
      return
    }
    dispatch({ type: 'draft/setBoard', boardId: preset.id })
    dispatch({ type: 'draft/setPlayerCount', playerCount: preset.playerCount })
    dispatch({
      type: 'draft/setAssignments',
      assignments: expandPreset(preset),
    })
  }, [state, dispatch])

  useEffect(() => {
    if (!isPlaying(state) && state.draft.playerCount === 0) {
      setScreen('setup')
    }
  }, [state])

  if (isPlaying(state)) {
    return (
      <DashboardScreen
        state={state}
        dispatch={dispatch}
        onClear={() => {
          dispatch({ type: 'game/clear' })
          setScreen('setup')
        }}
      />
    )
  }

  if (screen === 'deal') {
    return (
      <DealScreen
        draft={state.draft}
        dispatch={dispatch}
        onBack={() => setScreen('setup')}
      />
    )
  }

  return (
    <SetupScreen
      draft={state.draft}
      dispatch={dispatch}
      legacyDiscarded={showLegacyNotice}
      onDeal={() => setScreen('deal')}
    />
  )
}
