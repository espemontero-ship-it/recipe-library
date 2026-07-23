"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, user } = useAuth();

  if (loading) {
    return <main className="admin-gate">Checking session…</main>;
  }

  if (!user) {
    return (
      <main className="admin-gate">
        <p className="eyebrow">Sign in required</p>
        <h1>Sign in to use Planning and Shopping.</h1>
        <Link className="button button--dark" href="/login">
          Sign in
        </Link>
      </main>
    );
  }

  return <>{children}</>;
}
