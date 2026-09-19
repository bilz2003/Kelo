export function AuthSide() {
  return (
    <aside className="auth-side">
      <span className="label">One account</span>
      <h2 className="display h3" style={{ fontSize: "1.9rem", lineHeight: 1.1 }}>The same login works in the Kelo app.</h2>
      <p className="prose" style={{ margin: 0 }}>
        Your website account and your app account are one and the same &mdash; created here, usable there, and the other way round.
      </p>
      <div className="stmt">
        <div className="stmt-body">
          <div className="stmt-row"><span className="k">On the web</span><span className="v">listings · photos · earnings</span></div>
          <div className="stmt-row"><span className="k">In the app</span><span className="v">book · charge · add a charger</span></div>
        </div>
      </div>
    </aside>
  );
}
