# Setup is draft; Start commits

Board selection, role assignment, and deal reveal are editable draft state, autosaved but not event-logged. Start game appends one event carrying the final assignments; from then on every in-game mutation is one undoable event, last-only. This keeps setup freely correctable without weakening ADR-0003's single undo mechanism.

## Consequences

- Undoing Start while it is the last event returns to setup.
- After any later event, fixing a role requires undoing back to Start, undoing Start, editing, then starting again.
- No mid-game role reassignment by amendment.
