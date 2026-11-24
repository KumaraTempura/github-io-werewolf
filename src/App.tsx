import { useEffect, useState } from 'react'
import { isPlaying, type DraftState } from './game/state'
import { useNotebook } from './game/useNotebook'
import DashboardScreen from './ui/DashboardScreen'
import DealScreen from './ui/DealScreen'
import SetupScreen from './ui/SetupScreen'

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
    if (!isPlaying(state) && state.draft.playerCount === 0) {
      setScreen('setup')
    }
  }, [state])

  if (isPlaying(state)) {
    return (
      <DashboardScreen
        game={state.game}
        onToggleOut={(seat) => dispatch({ type: 'game/toggleOut', seat })}
        onReset={() => {
          dispatch({ type: 'game/reset' })
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
