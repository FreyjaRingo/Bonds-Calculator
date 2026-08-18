import { formatNumber } from "@/lib/format";

export interface ScatterPoint {
  code: string;
  year: number;
  yieldPct: number;
}

export interface BenchmarkCurve {
  label: string;
  color: string;
  points: ScatterPoint[];
}

const WIDTH = 960;
const HEIGHT = 460;
const PAD_LEFT = 46;
const PAD_RIGHT = 16;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;

function niceTicks(min: number, max: number, count: number): number[] {
  if (max <= min) return [min];
  const step = (max - min) / (count - 1);
  return Array.from({ length: count }, (_, i) => min + step * i);
}

/**
 * Port of ui_components.py::render_yield_curve's plotly chart: a scatter of
 * every quoted series ("Seri Bonds") plus one or more user-picked benchmark
 * curves drawn as connected, colored lines on top. Hand-rolled SVG -- no
 * charting library in this project and the dataset is small enough that it's
 * not worth adding one.
 */
export function BenchmarkYieldChart({ points, benchmarks }: { points: ScatterPoint[]; benchmarks: BenchmarkCurve[] }) {
  if (points.length === 0) return null;

  const allYields = [...points.map((p) => p.yieldPct), ...benchmarks.flatMap((b) => b.points.map((p) => p.yieldPct))];
  const allYears = [...points.map((p) => p.year), ...benchmarks.flatMap((b) => b.points.map((p) => p.year))];
  const yMin = Math.min(...allYields);
  const yMax = Math.max(...allYields);
  const yPad = Math.max(0.3, (yMax - yMin) * 0.1);
  const yLo = Math.max(0, yMin - yPad);
  const yHi = yMax + yPad;
  const xMin = Math.min(...allYears);
  const xMax = Math.max(...allYears);
  const xSpan = Math.max(1, xMax - xMin);

  const scaleX = (year: number) => PAD_LEFT + ((year - xMin) / xSpan) * (WIDTH - PAD_LEFT - PAD_RIGHT);
  const scaleY = (yieldPct: number) => HEIGHT - PAD_BOTTOM - ((yieldPct - yLo) / (yHi - yLo)) * (HEIGHT - PAD_TOP - PAD_BOTTOM);

  const yTicks = niceTicks(yLo, yHi, 6);
  const xTicks = niceTicks(xMin, xMax, Math.min(10, xSpan + 1));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-4 px-1 pb-2 text-[10px] text-ink-muted">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#5D9CEC" }} /> Seri Bonds
        </span>
        {benchmarks.map((b) => (
          <span key={b.label} className="flex items-center gap-1">
            <span className="inline-block h-0.5 w-3" style={{ background: b.color }} /> {b.label} Curve
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Bonds yield curve chart">
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={scaleY(t)} y2={scaleY(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD_LEFT - 6} y={scaleY(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-faint)" className="num">
              {formatNumber(t, 1)}%
            </text>
          </g>
        ))}
        {xTicks.map((t) => (
          <g key={t}>
            <line x1={scaleX(t)} x2={scaleX(t)} y1={PAD_TOP} y2={HEIGHT - PAD_BOTTOM} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
            <text x={scaleX(t)} y={HEIGHT - PAD_BOTTOM + 14} textAnchor="middle" fontSize={10} fill="var(--ink-faint)" className="num">
              {Math.round(t)}
            </text>
          </g>
        ))}
        <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={HEIGHT - PAD_BOTTOM} y2={HEIGHT - PAD_BOTTOM} stroke="var(--border)" strokeWidth={1} />

        {points.map((p) => (
          <g key={`scatter-${p.code}`}>
            <circle cx={scaleX(p.year)} cy={scaleY(p.yieldPct)} r={3.5} fill="#5D9CEC" fillOpacity={0.85}>
              <title>
                {p.code} — {p.year} — {formatNumber(p.yieldPct, 2)}%
              </title>
            </circle>
            <text x={scaleX(p.year) + 5} y={scaleY(p.yieldPct) - 4} fontSize={8} fill="var(--ink-muted)">
              {p.code}
            </text>
          </g>
        ))}

        {benchmarks.map((b) => {
          const sorted = [...b.points].sort((a, c) => a.year - c.year);
          const path = sorted.map((p, i) => `${i === 0 ? "M" : "L"}${scaleX(p.year).toFixed(1)},${scaleY(p.yieldPct).toFixed(1)}`).join(" ");
          return (
            <g key={b.label}>
              {path && <path d={path} fill="none" stroke={b.color} strokeWidth={2.5} />}
              {sorted.map((p) => (
                <circle key={`${b.label}-${p.code}`} cx={scaleX(p.year)} cy={scaleY(p.yieldPct)} r={5} fill={b.color} stroke="var(--surface)" strokeWidth={1}>
                  <title>
                    {b.label}: {p.code} — {p.year} — {formatNumber(p.yieldPct, 2)}%
                  </title>
                </circle>
              ))}
            </g>
          );
        })}
      </svg>
      <p className="mt-1 text-center text-[10px] text-ink-faint">Year</p>
    </div>
  );
}
