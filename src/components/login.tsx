"use client";
import { useState } from "react";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Field } from "./ui";
import { useWorkspace } from "./workspace-provider";
export function Login() {
  const { refresh, error, resetDemo, demo } = useWorkspace();
  const [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [code, setCode] = useState(""),
    [factorId, setFactorId] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <main className="login-page">
      <section className="login-story">
        <div className="brand-mark">
          H<span>HUTĀŚANA</span>
        </div>
        <div>
          <span className="eyebrow">CRAFTED SPACES. CONNECTED BUSINESS.</span>
          <h1>
            A little more order.
            <br />A lot more possibility.
          </h1>
          <p>
            From a first conversation to a kitchen that feels like home. Keep
            every detail together.
          </p>
        </div>
        <span>THE BUSINESS WORKSPACE · PUNE</span>
      </section>
      <section className="login-form">
        <div className="login-inner">
          <LockKeyhole size={28} />
          <h2>Welcome to your workspace</h2>
          <p>Sign in with your staff account to continue.</p>
          {error && <div className="alert">{error}</div>}
          {message && (
            <div className="alert" role="alert">
              {message}
            </div>
          )}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setMessage("");
              try {
                const response = await fetch("/api/auth", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(
                    factorId
                      ? { action: "verify", factorId, code }
                      : { action: "login", email, password },
                  ),
                });
                const data = await response.json();
                if (!response.ok) throw new Error(data.error);
                if (data.factorId) {
                  setFactorId(data.factorId);
                  setPassword("");
                } else refresh();
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Sign-in failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {factorId ? (
              <Field label="Authenticator code">
                <input
                  required
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </Field>
            ) : (
              <>
                <Field label="Work email">
                  <input
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@hutashana.com"
                  />
                </Field>
                <Field label="Password">
                  <input
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </Field>
              </>
            )}
            <button className="button primary full" disabled={busy}>
              {busy
                ? "Signing in…"
                : factorId
                  ? "Verify & continue"
                  : "Sign in"}
              <ArrowRight size={17} />
            </button>
          </form>
          <small>
            Invite-only access. Ask the owner for an account or password reset.
          </small>
          {demo && (
            <button className="button secondary" onClick={resetDemo}>
              Reset local demonstration
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
