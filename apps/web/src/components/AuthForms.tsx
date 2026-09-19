"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

async function post(path: string, body: unknown): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return { ok: true };
    const data = await res.json().catch(() => null);
    return { ok: false, message: data?.message ?? "Something went wrong — try again." };
  } catch {
    return { ok: false, message: "Couldn't reach Kelo — check your connection and try again." };
  }
}

// Mirrors the backend's RegisterDto rules so a host sees the problem before
// a round trip. The backend remains the authority.
function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 72) return "Password must be at most 72 characters";
  if (!/(?=.*[A-Za-z])(?=.*\d)/.test(pw)) return "Password must contain at least one letter and one number";
  return null;
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    const r = await post("/api/auth/login", { email, password });
    if (!r.ok) {
      setError(r.message ?? "Couldn't log in.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Password</label>
        <input id="password" className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || !email || !password}>{busy ? "Logging in…" : "Log in"}</button>
      <p className="hint" style={{ marginTop: 18 }}>
        New to Kelo? <Link className="link" href="/register">Create an account</Link>
      </p>
    </form>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const problem = passwordProblem(password);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setBusy(true);
    const r = await post("/api/auth/register", { name, email, password });
    if (!r.ok) {
      setError(r.message ?? "Couldn't create your account.");
      setBusy(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="field">
        <label className="label" htmlFor="name">Name</label>
        <input id="name" className="input" autoComplete="name" required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label className="label" htmlFor="email">Email</label>
        <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label className="label" htmlFor="password">Password</label>
        <input id="password" className="input" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        <span className="hint">At least 8 characters, with a letter and a number.</span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy || !name || !email || !password}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="hint" style={{ marginTop: 18 }}>
        Already have an account? <Link className="link" href="/login">Log in</Link>
      </p>
    </form>
  );
}
