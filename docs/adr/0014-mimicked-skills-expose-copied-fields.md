# Mimicked skills expose the copied role's fields

The awakened hidden wolf can copy any role, so a recorded `mimickedRole` makes that role's tracked fields available on the hidden wolf's own seat. The seat sheet merges the copied role's fields into the skill block, and a `roleState` event for the hidden wolf may target a field from either its own catalog entry or the copied role's. This answers the catalog's open question about mimic scope for custom play: every god role's options are copyable without listing them in the hidden wolf's entry.

## Considered Options

- Adding every god's fields to the awakened hidden wolf's catalog entry. Rejected: it duplicates around fifty fields, hard-codes the copy set the custom rule wants to avoid, and collides with the copy-specific fields the role already carries.
- Storing copied skill state under a separate namespace or event type. Rejected: copied skills are the seat's skill state, so reusing `roleState` keeps one undoable event shape and leaves stored games valid.
- Auto-filling `mimickedRole` from the mimic target's seat. Rejected: the notebook records what the judge says happened; the copied role stays an explicit entry, and custom play may differ from the seat assignment.

## Consequences

- Copied fields are validated and replayed against the currently recorded `mimickedRole`; changing the copy hides earlier copied fields from the seat sheet, though their events remain in the log.
- The hidden wolf's existing copy-specific fields (`extraAttackUsed`, `poisonUsed`, `guardLastTarget`) stay for stored games and show alongside the copied role's fields.
- Copied skill side effects still follow ADR-0013 by field key: setting a copied guard or antidote target revives a night-killed seat, and setting a copied shot target marks a seat out.
- Peek flows still use the assigned role's `peekKind`; the hidden wolf's own exact-role peek remains its mimic reveal, and the copied role's check fields are recorded as options.
