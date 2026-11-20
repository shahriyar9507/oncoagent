"use client";

import { useRef, useState } from "react";
import { DatourMark } from "./Logo";
import { IconShield } from "./icons";

/** Sign-in form. Credentials go to /api/auth/login; on success the server sets an httpOnly session cookie. */
export function LoginForm({ next }: { next?: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pwRef = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErr("Enter your username and password.");
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password, next }) });
      const j = (await res.json().catch(() => ({}))) as { error?: string; next?: string };
      if (!res.ok) {
        setErr(j.error ?? `Sign-in failed (HTTP ${res.status}).`);
        setPassword("");
        pwRef.current?.focus();
        return;
      }
      // Full navigation so the proxy sees the new cookie on the first request.
      window.location.assign(j.next ?? "/");
    } catch {
      setErr("Could not reach the server. Check the connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="login-card" onSubmit={submit} noValidate aria-labelledby="login-title">
      <span className="login-mark" aria-hidden="true"><DatourMark size={34} /></span>
      <h2 id="login-title">Sign in</h2>
      <p className="sub">Clinician workspace. Your session lasts 12 hours on this device.</p>
      <label className="field" htmlFor="lg-user">Username
        <input id="lg-user" name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} value={username} onChange={(e) => { setUsername(e.target.value); setErr(null); }} autoFocus required />
      </label>
      <label className="field" htmlFor="lg-pass">Password
        <span className="pw">
          <input id="lg-pass" ref={pwRef} name="password" type={show ? "text" : "password"} autoComplete="current-password" value={password} onChange={(e) => { setPassword(e.target.value); setErr(null); }} required aria-invalid={!!err} aria-describedby={err ? "lg-err" : undefined} />
          <button type="button" className="pw-toggle" onClick={() => setShow(!show)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"}>{show ? "Hide" : "Show"}</button>
        </span>
      </label>
      {err && <p id="lg-err" className="login-err" role="alert">{err}</p>}
      <button type="submit" className="btn primary login-submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      <p className="footer-note login-note"><IconShield width={13} height={13} /> Access is limited to authorised clinical staff. Attempts are rate-limited and logged.</p>
    </form>
  );
}
