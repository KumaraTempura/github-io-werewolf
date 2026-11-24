# Event schema and draft retention

Every in-game judge mutation is one event in a discriminated union: `start` (first only, carrying the committed setup), `used` (per-seat flag), `roleState` (one catalog tracked field on the seat's role, validated against the field type), `tableState` (replaces the whole seat list for one table state), `elimination` (seat plus reason, once per seat), `note` (optional seat), and `peek` (inspector, target, and the result as shown). Used flags, role state, and peeks are keyed by seat rather than role id, so repeated roles stay independent.

The pre-game draft is retained while the game is active, and Start copies the setup into the start event. This makes undoing Start exact, including reveal progress, without reconstructing setup from the log. Draft edits are rejected once events exist, and there is no role-reassignment event, so roles are fixed after Start.

Peek results are stored in the event as shown, not recomputed when read. A peek event carries `targetSeat` and may add `targetSeats` for multi-seat checks such as 覺醒預言家; single-target and older stored events omit the list. Undo removes the record but not the fact that the player saw the result. Table states follow the no-enforcement rule: badge and bound are not structurally limited to one holder or one pair.

Storage is one versioned localStorage record holding the draft and the event log. Loading replays every stored event through the same validation the live reducer uses and discards the record on any mismatch, so a hand-edited or stale record never becomes game state.

## Consequences

- Adding a mutation means adding an event type, not a new state write.
- Changing a table state replaces its whole seat list in one event; badge transfer is one event, not clear-then-set.
- The draft must match its start event on load, or the whole record is rejected.
- Peek history cannot be rewritten by later game state.
