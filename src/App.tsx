export default function App() {
  return (
    <main className="shell">
      <header className="shell__header">
        <p className="shell__eyebrow">單機法官筆記</p>
        <h1 className="shell__title">狼人殺法官筆記</h1>
        <p className="shell__lead">
          記錄每一場遊戲：發牌、查驗、出局與場上狀態。
        </p>
      </header>
      <section className="shell__status" aria-label="系統狀態">
        <span className="shell__dot" aria-hidden="true" />
        應用程式已部署，功能陸續加入。
      </section>
    </main>
  )
}
