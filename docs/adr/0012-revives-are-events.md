# Revives are explicit events

A night-kill prevention target on a role state — the witch's antidote, 法老之蛇, the guard's protection, or the awakened idiot's secret body — is a per-night note, not a revival. When that target is an out seat with reason `nightKill`, the seat sheet appends a `revive` event in addition to the role-state event; the out banner for a night-killed seat also offers an explicit 復活 action. The revive is its own undoable event, so later edits to the protection field cannot rewrite history, and a revival recorded before the kill can still be corrected.

## Considered Options

- Deriving revival from the current protection field. Rejected: changing the field on a later night would silently un-revive an earlier player.
- Inferring a revival when a night kill is recorded on a current protection target. Rejected: a stale protection target would silently cancel a kill; the explicit 復活 action covers the protection-before-kill order instead.

## Consequences

- A protection action can append two events: the role-state target and the revive. Undo removes the revive first.
- The out banner offers 復活 only for night kills; other reasons stay correction-by-undo.
- A revived seat can be eliminated again later.
