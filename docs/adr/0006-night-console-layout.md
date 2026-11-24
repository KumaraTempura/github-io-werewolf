# Night console layout

The judge console uses the "night console" layout picked from the throwaway prototype: a single centered column, large seat-number tiles on the dashboard, a role strip with manual used flags, and a fixed action dock (peek / events / undo). Seat state, role detail, and the event log open as bottom sheets, and judge-held reveals take over the full screen. This keeps one-handed phone use primary while remaining a centered console on desktop.

## Considered Options

- Radial table map with side panels (prototype variant B). Rejected: richer on desktop, but harder to scan on a phone and the side panels need duplicate mobile sheets anyway.
- Chronological ledger with a roster column (prototype variant C). Rejected: strong event history, but seats stop being the primary control surface and the phone layout gets denser.
- A separate layout per breakpoint. Rejected: two layouts to build and test for a single-device notebook.

## Consequences

- The seat grid is the dashboard's primary surface; the event log is secondary and opens in a sheet.
- Phone and desktop share one structure; desktop only widens the grid and dock.
- The throwaway prototype at `.scratch/werewolf-notebook/assets/prototype/judge-console.html` is the primary source for this layout, not production code.
