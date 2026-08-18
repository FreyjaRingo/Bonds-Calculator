import type { ReactNode } from "react";

/** Bright-yellow section-header bar, matching the source Excel workbook's own gold headers. */
export function SectionHeader({ children, index }: { children: ReactNode; index?: number }) {
  return (
    <div className="flex items-center gap-2 bg-accent px-3 py-1.5">
      {index != null && <span className="num text-[11px] font-semibold text-accent-ink/70">{String(index).padStart(2, "0")}</span>}
      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-accent-ink">{children}</h2>
    </div>
  );
}

/** Flat-bordered surface panel — no drop shadow, sharp corners. */
export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`border border-border bg-surface ${className}`}>{children}</div>;
}

/** A panel with a SectionHeader already attached on top. */
export function SectionPanel({ title, index, children }: { title: ReactNode; index?: number; children: ReactNode }) {
  return (
    <div>
      <SectionHeader index={index}>{title}</SectionHeader>
      <div className="border border-border bg-surface p-3">{children}</div>
    </div>
  );
}

export type Tone = "neutral" | "accent" | "positive" | "negative" | "warning";

const TONE_TEXT: Record<Tone, string> = {
  neutral: "text-ink",
  accent: "text-accent-strong",
  positive: "text-positive",
  negative: "text-negative",
  warning: "text-warning",
};

const TONE_BADGE: Record<Tone, string> = {
  neutral: "border-border text-ink-muted",
  accent: "border-accent/40 text-accent-strong",
  positive: "border-positive/35 text-positive",
  negative: "border-negative/35 text-negative",
  warning: "border-warning/35 text-warning",
};

/**
 * A compact metric row. Color is functional (semantic state), not decorative —
 * no filled background, just the value's ink color, matching how terminal-style
 * financial tools keep data quiet until it needs attention.
 */
export function Stat({ label, value, tone = "neutral", sub }: { label: string; value: string; tone?: Tone; sub?: string }) {
  return (
    <div className="border border-border bg-surface px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`num mt-0.5 text-base font-semibold leading-tight ${TONE_TEXT[tone]}`}>{value}</p>
      {sub && <p className="num mt-0.5 text-[11px] text-ink-faint">{sub}</p>}
    </div>
  );
}

/** Small state badge — e.g. "LOCK-UP", a verdict tag. Outline only, no fill. */
export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={`inline-flex items-center border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TONE_BADGE[tone]}`}>
      {children}
    </span>
  );
}

/** A prominent banner-style verdict, e.g. BEP comparison result. Left rule, not a filled chip. */
export function VerdictBanner({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  const ruleColor =
    tone === "positive" ? "border-positive" : tone === "negative" ? "border-negative" : tone === "warning" ? "border-warning" : "border-accent";
  return (
    <div className={`border-l-2 ${ruleColor} bg-surface-2 px-3 py-2 text-sm font-semibold ${TONE_TEXT[tone === "neutral" ? "neutral" : tone]}`}>
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

const inputBase =
  "w-full border border-border bg-surface px-2.5 py-1.5 text-sm text-ink outline-none transition-colors focus:border-accent";

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
      className={`bg-accent px-3 py-1.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
    />
  );
}

export function SecondaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { className = "", ...rest } = props;
  return (
    <button
      {...rest}
      className={`border border-border bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:border-accent/60 hover:text-accent-strong ${className}`}
    />
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-28 items-center justify-center border border-dashed border-border text-sm text-ink-faint">
      {message}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return <div className="border-l-2 border-negative bg-negative-soft px-3 py-2 text-sm text-negative">{message}</div>;
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function Thead({ children }: { children: ReactNode }) {
  return (
    <thead className="sticky top-0 border-b border-border bg-surface-2 text-[10px] uppercase tracking-wide text-ink-muted">
      {children}
    </thead>
  );
}
