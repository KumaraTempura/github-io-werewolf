import { useEffect, useReducer, type Dispatch } from 'react'
import {
  notebookReducer,
  type NotebookAction,
  type NotebookState,
} from './state'
import { loadNotebook, saveNotebook, type KeyValueStorage } from './storage'

export type NotebookDispatch = Dispatch<NotebookAction>

export function useNotebook(
  storage?: KeyValueStorage,
): readonly [NotebookState, NotebookDispatch] {
  const [state, dispatch] = useReducer(notebookReducer, null, () =>
    storage ? loadNotebook(storage) : loadNotebook(),
  )

  useEffect(() => {
    if (storage) {
      saveNotebook(state, storage)
    } else {
      saveNotebook(state)
    }
  }, [state, storage])

  return [state, dispatch] as const
}
