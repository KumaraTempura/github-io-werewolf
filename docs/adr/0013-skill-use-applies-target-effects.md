# Skill use applies its target effects

Recording a skill target applies its obvious outcome. Setting a `shotTarget` on the hunter, 狼王, or 白狼王 marks that seat out with reason 開槍. A completed peek carries the inspector's check-field updates (`checkedSeats`, `lastCheckTarget`, `lastCheckCamp`, `lastCheckRole`, `checkedPairs`, `lastPair`, `lastPairResult`) inside the peek event. The peek updates travel with the peek so one undo removes both the record and the derived check state. The shot elimination stays a separate event because it changes the out list, not role state; correcting the shot target later does not retract an earlier shot.

## Considered Options

- Leaving both effects manual. Rejected: the judge expects a recorded skill target to have its consequence, and the stale check fields are the reported bug.
- Appending separate role-state events after a peek. Rejected: undoing the peek would leave the check fields behind.
- Deriving the shot from the elimination reason instead of the target field. Rejected: it would invert the flow and lose the explicit target.

## Consequences

- Peek events may carry optional `updates`; older stored peeks remain valid.
- A peek is one undo step; a shot is two events (target field and elimination).
- Non-check peeks such as teammate reveals and last-exile reads do not update tracked fields.
