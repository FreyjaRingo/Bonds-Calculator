import type { ReactNode } from "react";

/** Gold section-header bar, echoing the source Excel workbook's own convention. */
export function SectionHeader({ children, index }: { children: ReactNode; index?: number }) {
  return (
    <div className="flex items-center gap-2 rounded-t-md border border-b-0 border-accent-strong/30 bg-accent px-4 py-2">
      {index != null && (
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-accent-ink text-[11px] font-semibold text-accent">
          {index}
        </span>
      )}
      <h2 className="text-sm font-semibold text-accent-ink">{children}</h2>
    </div>
  );
}

/** Flat-bordered surface panel — no drop shadow, a considered small radius. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-border bg-surface ${className}`}>{children}</div>;
}

/** A panel with a SectionHeader already attached on top. */
export function SectionPanel({ title, index, children }: { title: ReactNode; index?: number; children: ReactNode }) {
  return (
    <div>
      <SectionHeader index={index}>{title}</SectionHeader>
      <div className="rounded-b-md border border-border bg-surface p-4">{children}</div>
    </div>
  );
}

export type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const TONE_CLASSES: Record<Tone, string> = {
  neutral: "border-border bg-surface text-ink",
  accent: "border-accent-strong/40 bg-accent-soft text-accent-ink",
  positive: "border-positive/25 bg-positive-soft text-positive",
  negative: "border-negative/25 bg-negative-soft text-negative",
  warning: "border-warning/25 bg-warning-soft text-warning",
};

/** A single metric tile. Value is set in the mono/tabular face. */
export function Stat({ label, value, tone = "neutral", sub }: { label: string; value: string; tone?: Tone; sub?: string }) {
  return (
    <div className={`rounded-md border p-3.5 ${TONE_CLASSES[tone]}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</p>
      <p className="num mt-1 text-lg font-semibold leading-tight">{value}</p>
      {sub && <p className="mt-0.5 text-xs opacity-70">{sub}</p>}
    </div>
  );
}

/** Small state pill — e.g. "LOCK-UP", "IDR", a verdict. */
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${TONE_CLASSES[tone]}`}>
      {children}
    </span>
  );
}

/** A prominent banner-style verdict, e.g. BEP comparison result. */
export function VerdictBanner({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return <div className={`rounded-md border px-4 py-3 text-sm font-semibold ${TONE_CLASSES[tone]}`}>{children}</div>;
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

const inputBase =
  "w-full rounded border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent-strong";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input {...rest} className={`${inputBase} ${className}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select {...rest} className={`${inputBase} ${className}`} />;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`rounded border border-border bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:border-accent-strong/50 hover:text-accent-strong ${className}`}
    />
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border bg-surface text-sm text-ink-faint">
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-negative/25 bg-negative-soft px-4 py-3 text-sm text-negative">{message}</div>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 border-b border-border bg-surface-2 text-[11px] uppercase tracking-wide text-ink-muted">
      {children}
    </thead>
  );
}
