import { formatNumber } from "@/lib/format";

export interface YieldCurvePoint {
  code: string;
  years: number;
  beli: number | null;
  jual: number | null;
}

const WIDTH = 480;
const HEIGHT = 220;
const PAD_LEFT = 38;
const PAD_RIGHT = 12;
const PAD_TOP = 10;
const PAD_BOTTOM = 24;

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/**
 * Minimal dependency-free SVG yield curve: yield (%) on Y, years-to-maturity on
 * X, one line per side of the market (Beli/Jual). No charting library in this
 * project, and the dataset per section is small (a handful of benchmark
 * tenors), so a hand-rolled polyline is simpler than pulling one in.
 */
export function YieldCurveChart({ title, points }: { title: string; points: YieldCurvePoint[] }) {
  const sorted = [...points].sort((a, b) => a.years - b.years);
  const allYields = sorted.flatMap((p) => [p.beli, p.jual].filter((v): v is number => v != null));
  const yMin = Math.min(...allYields);
  const yMax = Math.max(...allYields);
  const yPad = Math.max(0.15, (yMax - yMin) * 0.12);
  const yLo = yMin - yPad;
  const yHi = yMax + yPad;
  const xMax = Math.max(...sorted.map((p) => p.years));

  const scaleX = (years: number) => PAD_LEFT + (years / xMax) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const scaleY = (yieldPct: number) => HEIGHT - PAD_BOTTOM - ((yieldPct - yLo) / (yHi - yLo)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const beliPath = sorted
    .filter((p) => p.beli != null)
    .map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(p.years).toFixed(1)},${scaleY(p.beli!).toFixed(1)}`)
    .join(" ");
  const jualPath = sorted
    .filter((p) => p.jual != null)
    .map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(p.years).toFixed(1)},${scaleY(p.jual!).toFixed(1)}`)
    .join(" ");

  const yTicks = niceTicks(yLo, yHi, 4);
  const xTicks = niceTicks(0, xMax, Math.min(5, sorted.length));

  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-ink">{title}</h3>
        <div className="flex items-center gap-3 text-[10px] text-ink-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 bg-accent-strong" /> Yield Beli
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3 bg-ink" /> Yield Jual
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label={`Kurva yield ${title}`}>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={scaleY(t)} y2={scaleY(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD_LEFT - 6} y={scaleY(t) + 3} textAnchor="end" fontSize={9} fill="var(--ink-faint)" className="num">
              {formatNumber(t, 1)}%
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <text key={t} x={scaleX(t)} y={HEIGHT - PAD_BOTTOM + 14} textAnchor="middle" fontSize={9} fill="var(--ink-faint)" className="num">
            {formatNumber(t, 0)}th
          </text>
        ))}
        <line
          x1={PAD_LEFT}
          x2={WIDTH - PAD_RIGHT}
          y1={HEIGHT - PAD_BOTTOM}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="var(--border)"
          strokeWidth={1}
        />
        {jualPath && <path d={jualPath} fill="none" stroke="var(--ink)" strokeWidth={1.5} />}
        {beliPath && <path d={beliPath} fill="none" stroke="var(--accent-strong)" strokeWidth={1.5} />}
        {sorted.map((p) => (
          <g key={p.code}>
            {p.beli != null && (
              <circle cx={scaleX(p.years)} cy={scaleY(p.beli)} r={2.5} fill="var(--accent-strong)">
                <title>
                  {p.code} — {formatNumber(p.years, 1)} th — Beli {formatNumber(p.beli, 2)}%
                </title>
              </circle>
            )}
            {p.jual != null && (
              <circle cx={scaleX(p.years)} cy={scaleY(p.jual)} r={2.5} fill="var(--ink)">
                <title>
                  {p.code} — {formatNumber(p.years, 1)} th — Jual {formatNumber(p.jual, 2)}%
                </title>
              </circle>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
