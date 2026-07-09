"use client";

type ProgressRowProps = {
  label: string;
  count: number;
  percentage: number;
  color?: string;
};

export function ProgressRow({ label, count, percentage, color = "bg-zinc-500" }: ProgressRowProps) {
  return (
    <div className="rounded-lg px-3 py-2 hover:bg-zinc-800">
      <div className="flex items-center justify-between gap-3">
        <span className="truncate text-sm font-medium text-zinc-300 capitalize">{label}</span>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-zinc-200">{count.toLocaleString()}</span>
          <span className="w-9 text-right text-xs text-zinc-500">{percentage}%</span>
        </div>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${Math.max(percentage, count > 0 ? 2 : 0)}%` }}
        />
      </div>
    </div>
  );
}

type BarChartProps = {
  data: { label: string; value: number }[];
  maxValue?: number;
  color?: string;
  height?: number;
  showLabels?: boolean;
  showValues?: boolean;
};

export function BarChart({
  data,
  maxValue,
  color = "rgb(16 185 129 / 0.8)",
  height = 180,
  showLabels = true,
  showValues = false,
}: BarChartProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex h-full items-end gap-2" style={{ minHeight: height }}>
      {data.map((point, i) => {
        const barHeight = (point.value / max) * 100;
        return (
          <div
            key={i}
            className="group relative flex flex-1 flex-col items-center justify-end"
            style={{ height: "100%" }}
          >
            {showValues && (
              <span className="mb-1 text-[10px] font-medium text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100">
                {point.value}
              </span>
            )}
            <div
              className="w-full rounded-t-md transition-all duration-500 ease-out hover:opacity-80"
              style={{
                height: `${barHeight}%`,
                backgroundColor: color,
                minHeight: point.value > 0 ? "4px" : "0px",
              }}
            />
            {showLabels && (
              <span className="mt-1.5 truncate text-[10px] text-zinc-500">{point.label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

type HorizontalBarProps = {
  data: { name: string; count: number; percentage: number; color: string }[];
  maxValue?: number;
};

export function HorizontalBar({ data, maxValue }: HorizontalBarProps) {
  const max = maxValue ?? Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-2.5">
      {data.map((item, i) => (
        <div key={i} className="group">
          <div className="mb-1 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.color}`} />
              <span className="font-medium text-zinc-300 capitalize">{item.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-zinc-500">{item.count.toLocaleString()}</span>
              <span className="w-10 text-right text-xs font-semibold text-zinc-400">{item.percentage}%</span>
            </div>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${item.color}`}
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}