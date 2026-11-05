interface ProgressBarProps {
  value: number;
  label: string;
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  const percent = Math.round(Math.max(0, Math.min(1, value)) * 100);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="h-2 border border-border rounded-card overflow-hidden bg-background"
    >
      <div className="h-full bg-accent transition-[width] duration-200 ease-zune" style={{ width: `${percent}%` }} />
    </div>
  );
}
