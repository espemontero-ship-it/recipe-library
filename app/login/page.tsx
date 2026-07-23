"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading, signInWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("password") === "updated") {
      setMessage("Password updated. Sign in with your new password.");
      window.history.replaceState({}, "", "/login");
    }
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await signInWithPassword(email.trim(), password);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : "";
      setError(
        detail.toLowerCase().includes("invalid login credentials")
          ? "Incorrect email or password."
          : detail || "Could not sign in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <main className="login-page">Checking session…</main>;
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Kitchen Index administration</p>
        <h1>Sign in</h1>
        <p>Use your administrator email and password.</p>

        <form onSubmit={handleSubmit}>
          <label>
            Email
            <input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>

          <label>
            Password
            <input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              required
              type="password"
              value={password}
            />
          </label>

          <div className="login-inline-action">
            <Link href="/forgot-password">Forgot your password?</Link>
          </div>

          <div className="login-inline-action">
            <Link href="/signup">Don&apos;t have an account? Sign up</Link>
          </div>

          {error && <p className="login-error">{error}</p>}
          {message && <p className="login-success" role="status">{message}</p>}

          <button className="button button--dark" disabled={submitting} type="submit">
            <LogIn aria-hidden="true" size={17} />
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <Link href="/browse">Return to the public library</Link>
      </section>
    </main>
  );
}
