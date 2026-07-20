"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";
import { getSupabaseClient } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function ResetPasswordPage() {
  const router = useRouter();
  const { updatePassword, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setChecking(false);
      setError("Supabase environment variables are missing.");
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setRecoveryReady(Boolean(data.session));
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || session) {
        setRecoveryReady(true);
      }
      setChecking(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("The passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      await updatePassword(password);
      await signOut();
      router.replace("/login?password=updated");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not update the password.");
      setSubmitting(false);
    }
  }

  if (checking) {
    return <main className="login-page">Checking reset link…</main>;
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Recipe Library administration</p>
        <h1>Choose a new password</h1>

        {!recoveryReady ? (
          <>
            <p>This password-reset link is invalid or has expired.</p>
            {error && <p className="login-error">{error}</p>}
            <Link href="/forgot-password">Request another reset link</Link>
          </>
        ) : (
          <>
            <p>Set a new password for your administrator account.</p>

            <form onSubmit={handleSubmit}>
              <label>
                New password
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
              </label>

              <label>
                Confirm new password
                <input
                  autoComplete="new-password"
                  minLength={8}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>

              <p className="login-password-hint">Use at least 8 characters.</p>
              {error && <p className="login-error">{error}</p>}

              <button className="button button--dark" disabled={submitting} type="submit">
                <KeyRound aria-hidden="true" size={17} />
                {submitting ? "Updating…" : "Set new password"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
