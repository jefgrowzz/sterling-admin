type StatsCardProps = {
  title: string;
  value: string;
  change: string;
  tone?: "emerald" | "amber" | "rose" | "slate" | "blue" | "violet";
  icon?: React.ReactNode;
  subtitle?: string;
};

const toneClasses = {
  emerald: "bg-emerald-500/15 text-emerald-300",
  amber: "bg-amber-500/15 text-amber-300",
  rose: "bg-rose-500/15 text-rose-300",
  slate: "bg-zinc-800 text-zinc-300",
  blue: "bg-blue-500/15 text-blue-300",
  violet: "bg-violet-500/15 text-violet-300",
};

const accentClasses = {
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-zinc-500",
  blue: "bg-blue-500",
  violet: "bg-violet-500",
};

export function StatsCard({ title, value, change, tone = "slate", icon, subtitle }: StatsCardProps) {
  const hasChange = change && change.length > 0;

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-sm transition-all hover:shadow-md hover:border-zinc-700">
      {/* Top accent line */}
      <div className={`absolute inset-x-0 top-0 h-0.5 ${accentClasses[tone]} opacity-60`} />

      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {icon && <span className="shrink-0 text-zinc-500">{icon}</span>}
            <p className="truncate text-sm font-medium text-zinc-400">{title}</p>
          </div>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-zinc-50">{value}</p>
          {subtitle && (
            <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>
          )}
        </div>
        {hasChange && (
          <span className={`ml-3 shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses[tone]}`}>
            {change}
          </span>
        )}
      </div>
    </div>
  );
}
