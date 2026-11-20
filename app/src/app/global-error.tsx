"use client";

// Last-resort boundary when the root layout itself fails. Plain inline styles: globals.css may not have loaded.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#050807", color: "#e9f2ed", fontFamily: "Inter, Segoe UI, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 440, padding: 28, border: "1px solid rgba(140,255,200,0.17)", borderRadius: 18, background: "#0f1613" }}>
          <p style={{ fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "#7a8c82", margin: 0 }}>OncoAgent</p>
          <h1 style={{ fontSize: 22, margin: "8px 0" }}>The workspace failed to load.</h1>
          <p style={{ color: "#b0c0b7", fontSize: 14, lineHeight: 1.5 }}>Saved data is not affected. Reload to try again.{error.digest ? ` Reference: ${error.digest}` : ""}</p>
          <button type="button" onClick={reset} style={{ marginTop: 12, minHeight: 42, padding: "0 18px", borderRadius: 999, border: 0, background: "#17ff88", color: "#041a0d", fontWeight: 600, cursor: "pointer" }}>Reload</button>
        </div>
      </body>
    </html>
  );
}
