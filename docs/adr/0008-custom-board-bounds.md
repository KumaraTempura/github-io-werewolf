# Custom board bounds

Custom boards use 7–12 seats, may repeat any catalog role, and may only use roles that exist in the role catalog. Presets already span that seat range, and the role-state schema validates every field against a catalog role, so inventing roles at runtime would create state the core cannot replay.

## Considered Options

- Allow arbitrary seat counts. Rejected for this build: the seat grid and setup flow are sized for the rulebook's 7–12 range, and no rulebook preset falls outside it.
- Allow free-text roles outside the catalog. Rejected: events and tracked state are keyed to catalog role ids, and an unknown role would fail load-time replay validation.

## Consequences

- A custom board is a custom composition of known roles, not a way to define new roles.
- Supporting smaller or larger tables, or new roles, requires changing the catalog or this bound rather than bypassing it in the UI.
- Composition balance is not checked; the judge may build any arrangement of catalog roles.
