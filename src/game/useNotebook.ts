import { useEffect, useReducer, useState, type Dispatch } from 'react'
import {
  notebookReducer,
  type NotebookAction,
  type NotebookState,
} from './state'
import {
  loadNotebookWithStatus,
  saveNotebook,
  type KeyValueStorage,
} from './storage'

export type NotebookDispatch = Dispatch<NotebookAction>

export function useNotebook(
  storage?: KeyValueStorage,
): readonly [NotebookState, NotebookDispatch, boolean] {
  const [initial] = useState(() =>
    storage ? loadNotebookWithStatus(storage) : loadNotebookWithStatus(),
  )
  const [state, dispatch] = useReducer(notebookReducer, initial.state)

  useEffect(() => {
    if (storage) {
      saveNotebook(state, storage)
    } else {
      saveNotebook(state)
    }
  }, [state, storage])

  return [state, dispatch, initial.legacyDiscarded] as const
}
