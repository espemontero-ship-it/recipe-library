"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";

export default function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Could not send the password reset email.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">Kitchen Index administration</p>
        <h1>Reset password</h1>
        <p>
          Enter your administrator email. We will send a password-reset link that
          opens the page where you can choose a new password.
        </p>

        {sent ? (
          <div className="login-confirmation" role="status">
            <strong>Check your email.</strong>
            <p>
              If the address belongs to an account, you will receive a link to set
              a new password. The link does not sign you into the library.
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

            {error && <p className="login-error">{error}</p>}

            <button className="button button--dark" disabled={submitting} type="submit">
              <Mail aria-hidden="true" size={17} />
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        )}

        <Link href="/login">Back to sign in</Link>
      </section>
    </main>
  );
}
