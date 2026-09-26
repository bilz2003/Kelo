"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { normalizeEmail } from "@kelo/core";

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

// Mirrors the backend's RegisterDto rules so a person sees the problem before a
// round trip. The backend (and the BFF in front of it) remain the authority.
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters";
  if (pw.length > 72) return "Password must be at most 72 characters";
  if (!/(?=.*[A-Za-z])(?=.*\d)/.test(pw)) return "Password must contain at least one letter and one number";
  return null;
}

const EMAIL_RE = /^\S+@\S+\.\S+$/;

function Field(props: {
  id: string; label: string; type?: string; value: string; onChange: (v: string) => void; onBlur?: () => void;
  placeholder?: string; autoComplete?: string; error?: string | null; hint?: string; maxLength?: number; extra?: React.ReactNode;
}) {
  const described = props.error ? `${props.id}-err` : props.hint ? `${props.id}-hint` : undefined;
  return (
    <div className="af-field">
      <div className="af-label-row">
        <label htmlFor={props.id}>{props.label}</label>
        {props.extra}
      </div>
      <input
        id={props.id} className="af-input" type={props.type ?? "text"} value={props.value} placeholder={props.placeholder}
        autoComplete={props.autoComplete} maxLength={props.maxLength} aria-invalid={!!props.error} aria-describedby={described}
        onChange={(e) => props.onChange(e.target.value)} onBlur={props.onBlur}
      />
      {props.error ? <p id={`${props.id}-err`} className="af-error" role="alert">{props.error}</p> : props.hint ? <p id={`${props.id}-hint`} className="af-hint">{props.hint}</p> : null}
    </div>
  );
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
    // The button stays fully visible (as in the mockup) rather than greying out while empty, so an empty submit is explained instead.
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
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
      <Field id="email" label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoComplete="email" />
      <Field
        id="password" label="Password" type="password" value={password} onChange={setPassword} placeholder="••••••••" autoComplete="current-password"
        // No password-reset flow exists in the backend yet — this is the mockup's link, left as a placeholder.
        extra={<a href="#" className="af-forgot" onClick={(e) => e.preventDefault()}>Forgot password?</a>}
      />
      {error && <p className="af-form-error" role="alert">{error}</p>}
      <button className="af-submit" disabled={busy}>{busy ? "Logging in…" : "Log in"}</button>
      <p className="af-switch">Don&apos;t have an account? <Link href="/register">Sign up</Link></p>
    </form>
  );
}

type Touched = Partial<Record<"firstName" | "lastName" | "email" | "confirmEmail" | "password" | "confirmPassword", boolean>>;

export function RegisterForm() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Touched>({});
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const trimmed = { first: firstName.trim(), last: lastName.trim(), email: email.trim(), confirmEmail: confirmEmail.trim() };
  const errors = {
    firstName: !trimmed.first ? "Enter your first name" : null,
    lastName: !trimmed.last ? "Enter your last name" : null,
    email: !trimmed.email ? "Enter your email" : !EMAIL_RE.test(trimmed.email) ? "Enter a valid email address" : null,
    confirmEmail: !trimmed.confirmEmail ? "Confirm your email" : normalizeEmail(trimmed.confirmEmail) !== normalizeEmail(trimmed.email) ? "Emails don’t match" : null,
    password: passwordProblem(password),
    confirmPassword: !confirmPassword ? "Confirm your password" : confirmPassword !== password ? "Passwords don’t match" : null,
  };
  const show = (k: keyof Touched) => (submitted || touched[k] ? errors[k] : null);
  const touch = (k: keyof Touched) => () => setTouched((t) => ({ ...t, [k]: true }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setSubmitted(true);
    setError(null);
    if (Object.values(errors).some(Boolean)) return;
    setBusy(true);
    const r = await post("/api/auth/register", { firstName: trimmed.first, lastName: trimmed.last, email: trimmed.email, confirmEmail: trimmed.confirmEmail, password, confirmPassword });
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
      <Field id="firstName" label="First name" value={firstName} onChange={setFirstName} onBlur={touch("firstName")} placeholder="First name" autoComplete="given-name" maxLength={50} error={show("firstName")} />
      <Field id="lastName" label="Last name" value={lastName} onChange={setLastName} onBlur={touch("lastName")} placeholder="Last name" autoComplete="family-name" maxLength={50} error={show("lastName")} />
      <Field id="email" label="Email" type="email" value={email} onChange={setEmail} onBlur={touch("email")} placeholder="you@example.com" autoComplete="email" error={show("email")} />
      <Field id="confirmEmail" label="Confirm email" type="email" value={confirmEmail} onChange={setConfirmEmail} onBlur={touch("confirmEmail")} placeholder="you@example.com" autoComplete="off" error={show("confirmEmail")} />
      <Field
        id="password" label="Password" type="password" value={password} onChange={setPassword} onBlur={touch("password")} placeholder="••••••••" autoComplete="new-password"
        error={show("password")} hint="At least 8 characters, with a letter and a number."
      />
      <Field id="confirmPassword" label="Confirm password" type="password" value={confirmPassword} onChange={setConfirmPassword} onBlur={touch("confirmPassword")} placeholder="••••••••" autoComplete="new-password" error={show("confirmPassword")} />
      {error && <p className="af-form-error" role="alert">{error}</p>}
      <button className="af-submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="af-switch">Already have an account? <Link href="/login">Log in</Link></p>
    </form>
  );
}
