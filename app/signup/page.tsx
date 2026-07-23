"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function SignUpPage() {
  const router = useRouter();
  const { user, loading, signUpWithPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      const { signedIn } = await signUpWithPassword(email.trim(), password);
      if (signedIn) {
        router.replace("/");
      } else {
        setAwaitingConfirmation(true);
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Could not create the account.",
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
        <p className="eyebrow">Recipe Library</p>
        <h1>Create an account</h1>
        <p>Sign up with your email to use Planning and Shopping.</p>

        {awaitingConfirmation ? (
          <div className="login-confirmation" role="status">
            <strong>Check your email.</strong>
            <p>
              We sent a confirmation link to {email}. Confirm your account, then
              sign in.
            </p>
          </div>
        ) : (
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
                autoComplete="new-password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>

            {error && <p className="login-error">{error}</p>}

            <button className="button button--dark" disabled={submitting} type="submit">
              <UserPlus aria-hidden="true" size={17} />
              {submitting ? "Creating account…" : "Sign up"}
            </button>
          </form>
        )}

        <Link href="/login">Already have an account? Sign in</Link>
      </section>
    </main>
  );
}
