# Seat-centric console with in-seat skills and peeks

The in-game screen is seats only. The role strip and role-detail sheet are removed, and the seat sheet becomes the single hub: role text, skill use (used flag and tracked fields), peek, table states, and eliminations. The dock keeps only events and undo. Peek moves into the seat sheet for every role whose catalog `peekKind` is not `none`, with the inspector fixed to that seat; roles without a catalog peek have no peek action. Finishing or cancelling a peek returns to the same seat sheet, and out seats keep their skill controls.

## Considered Options

- Keeping the role strip and dock peek. Rejected: seats already carry the role, and the strip duplicated the seat grid while the dock peek duplicated the per-seat skill entry.
- Keeping the any-role custom peek from ADR-0009. Rejected: "check" is a role skill, so non-peek roles should not offer it. Custom result editing remains inside real peeks.

## Consequences

- Seats are the primary and only in-game control surface; role information is read per seat.
- Skill visibility follows the catalog: only roles with tracked fields or a peek kind show a skill block.
- ADR-0006's role strip and dock peek and ADR-0009's any-role custom peek are retired.
