# Single-device static judge console

The app is a static GitHub Pages SPA operated by one judge on one shared device. Players never connect their own devices and there is no backend. A per-player app would require accounts, realtime sync, and secret delivery to separate screens — a different product. GitHub Pages also rules out server-side state.

## Considered Options

- Per-player web app with room codes and a realtime backend. Rejected: much larger scope, and the notebook's secret information belongs to the judge.
