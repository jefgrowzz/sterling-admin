"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-3xl border border-red-900/50 bg-zinc-900 p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-red-400">Error</p>
      <h2 className="mt-2 text-2xl font-semibold text-zinc-50">Something went wrong</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
        {error.message || "An unexpected error occurred while loading this page."}
      </p>
      <button
        onClick={reset}
        className="mt-5 rounded-full border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700"
      >
        Try again
      </button>
    </div>
  );
}
