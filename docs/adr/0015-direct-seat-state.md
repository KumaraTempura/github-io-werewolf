# Direct seat state instead of an event log

The in-play notebook is now direct mutable seat state: each seat records a role, out flag, copied target, used flags, and table states, and the judge chooses every reveal result manually. Setup and both deal flows remain, but phases, the event log and undo, role-specific skill fields, and the peek flow are removed so every role exposes the same controls. This trades the audit trail and one-step undo for a faster, rule-agnostic console; reset wipes the game and returns to the default setup page.

## Consequences

- Corrections are direct edits; there is no undo or event history, and reset discards the game.
- Role reveals show the seat's marked role and camp; 好人/狼人 reveals are judge-chosen, not derived.
- 隱狼 is a catalog role with the same controls as every other role; its rules are not modeled.
- ADR-0003, 0007, 0009, 0010, 0012, 0013, and 0014 are superseded. ADR-0006 and 0011 are superseded in their phase, dock, skill, and peek parts; the seat-centric console and judge-held reveals remain. ADR-0001, 0002, 0004, 0005, and 0008 still apply, except ADR-0005's no-mid-game-role-reassignment consequence: roles are directly editable after Start with no undo-and-restart step.
