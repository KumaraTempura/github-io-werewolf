# Peek results and custom fallback

The peek flow derives the shown result from the inspecting role's catalog `peekKind` against the current derived game: exact role (with the mirror maiden seeing a mimicked awakened hidden wolf's mimicked role), good/wolf camp, teammate numbers, or the last exiled player's camp. The judge chooses the inspector and the target seats; for teammate-number peeks the selected seats are the numbers revealed, so 尋香魅影 can reveal one and 狼鴉之爪 can reveal every known wolf. A single-target peek can be one-tap overridden to the target's exact role.

Roles whose catalog peek kind is `none`, and any peek the judge wants to treat under custom rules, use a manual result editor with the same four result kinds. This keeps the notebook non-enforcing: any in-play role can peek any seat, at any time, any number of times, and the judge can record a result the catalog would not derive.

Peek events keep `targetSeat` as the primary target and may add `targetSeats` when a role checks more than one player (覺醒預言家); older single-target records omit it, so stored games stay readable. The result is stored as shown and is not recomputed by later state.

## Consequences

- Peek history is a record of what the judge presented, not a rules lookup.
- Undo removes the record but cannot unsee the result, so undoing a peek asks for confirmation.
- Tracked role fields stay manual; a peek does not append role-state events.
