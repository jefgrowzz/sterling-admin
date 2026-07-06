"use client";

import { useActionState } from "react";
import { login } from "@/lib/auth/actions";

export default function Home() {
  const [state, formAction, pending] = useActionState(login, undefined);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-16">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Sign in
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-zinc-50">Welcome back</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-400">
          Sign in with your Sterling admin account.
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-zinc-300">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-50 outline-none ring-0 placeholder:text-zinc-500"
              placeholder="admin@sterling.test"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-300">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-zinc-50 outline-none ring-0 placeholder:text-zinc-500"
              placeholder="••••••••"
            />
          </div>

          {state?.error && (
            <p className="rounded-xl bg-rose-500/15 px-4 py-3 text-sm text-rose-300">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="flex w-full items-center justify-center rounded-full bg-white px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Signing in…" : "Continue"}
          </button>
        </form>
      </div>
    </main>
  );
}
