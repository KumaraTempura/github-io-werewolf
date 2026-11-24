# Day/night cycles and phase events

The judge advances play manually through cycles: one night followed by one daytime, displayed as 第 N 天. Start implies Night 1 with no opening phase event; every advance appends an explicit `phase` event carrying its cycle and phase. Validation allows only night → daytime in the same cycle, then daytime → night in the next cycle. The event log groups events into cycle tabs from these events, and undo stays last-event-only.

## Considered Options

- Separate day and night tabs. Rejected: the judge thinks in day cycles, and "one day and night" is the reading unit.
- Deriving the cycle by counting advances. Rejected: storing `{cycle, phase}` makes tab labels and storage validation unambiguous.

## Consequences

- The current phase is the last phase event, or Night 1 before the first advance.
- Cycles with no action rows are hidden except the current cycle; phase markers stay unnumbered.
- Used flags, tracked role state, table states, and out status persist across phases.
- Storage version 2 discards version 1 notebooks; setup shows a one-time notice.
