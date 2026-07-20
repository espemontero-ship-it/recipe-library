"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    loading,
    isAdmin,
    sendMagicLink,
    signInWithGoogle,
    signOut,
  } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!loading && isAdmin) router.replace("/");
  }, [loading, isAdmin, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      await sendMagicLink(email.trim());
      setMessage("Check your email and open the sign-in link.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send the sign-in link.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setGoogleSubmitting(true);
    setError("");
    setMessage("");
    try {
      await signInWithGoogle();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not start Google sign-in.",
      );
      setGoogleSubmitting(false);
    }
  }

  if (loading) {
    return <main className="login-page">Checking session…</main>;
  }

  if (user && !isAdmin) {
    return (
      <main className="login-page">
        <section className="login-card">
          <p className="eyebrow">No administrator permission</p>
          <h1>This account can view recipes but cannot edit the library.</h1>
          <button className="button button--dark" onClick={() => void signOut()} type="button">
            Sign out
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Recipe Library administration</p>
        <h1>Sign in</h1>
        <p>Your friends can browse without an account. Sign in with Google or use the administrator email link.</p>

        <button
          className="login-google-button"
          disabled={googleSubmitting || submitting}
          onClick={() => void handleGoogleSignIn()}
          type="button"
        >
          <span aria-hidden="true" className="login-google-mark">G</span>
          {googleSubmitting ? "Opening Google…" : "Continue with Google"}
        </button>

        <div className="login-divider"><span>or</span></div>

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

          {error && <p className="login-error">{error}</p>}
          {message && <p role="status">{message}</p>}

          <button className="button button--dark" disabled={submitting} type="submit">
            <Mail aria-hidden="true" size={17} />
            {submitting ? "Sending…" : "Send sign-in link"}
          </button>
        </form>

        <Link href="/browse">Return to the public library</Link>
      </section>
    </main>
  );
}
