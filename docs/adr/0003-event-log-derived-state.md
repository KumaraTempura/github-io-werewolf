# Event log with derived state

Every judge action is appended as an event; the current game state is derived from the log; undo removes the last event. This satisfies the undo requirement with one mechanism instead of per-feature undo, and it keeps the single active game consistent. Only the active game is autosaved to localStorage; there is no archive.

## Considered Options

- Mutable state with snapshot undo. Rejected: every new state field would need its own undo path.

## Consequences

- The event schema must cover every mutation; no ad-hoc state writes.
- Amending a past event is not possible unless a ticket explicitly adds it; normal correction is undo from the end.
