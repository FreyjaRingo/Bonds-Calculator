"use client";

import { useMemo, useRef, useState } from "react";
import type { PriceQuoteRow } from "@/lib/priceQuoteParser";
import { parseMaturityText } from "@/lib/priceQuoteParser";
import { formatNumber, toDateInputValue } from "@/lib/format";
import {
  classifyCurrency,
  classifyBondType,
  calcDuration,
  calcRateImpact,
  calcYearsToMaturity,
  calcPriceFromYield,
} from "@/lib/priceIndicationCalc";
import { Panel, SectionHeader, PrimaryButton, SecondaryButton, Pill, EmptyState, TextInput, Select, Table, Thead } from "@/components/ui";
import { BenchmarkYieldChart, type ScatterPoint, type BenchmarkCurve } from "@/components/BenchmarkYieldChart";

interface PriceSheet {
  asOfDate: string | null;
  rows: PriceQuoteRow[];
}

type CurrencyFilter = "Semua" | "IDR" | "USD";

interface SimParams {
  settlement: Date;
  base: Date;
  cutRate: number;
  yieldHike: number;
  yieldCut: number;
}

interface RowCalc {
  row: PriceQuoteRow;
  currency: "IDR" | "USD";
  bondType: "Syariah" | "Konvensional";
  maturityDate: Date | null;
  maturityYear: number | null;
  modifiedDuration: number | null;
  rateHike: number | null;
  rateCut: number | null;
  rateHikePrice: number | null;
  rateCutPrice: number | null;
  totalYearToMaturity: number | null;
  priceIfYieldHike: number | null;
  priceIfYieldCut: number | null;
}

function couponToDecimal(couponText: string): number | null {
  const m = couponText.match(/-?\d+(?:\.\d+)?/);
  return m ? Number(m[0]) / 100 : null;
}

function computeRow(row: PriceQuoteRow, params: SimParams): RowCalc {
  const currency = classifyCurrency(row.productCode);
  const bondType = classifyBondType(row.productCode);
  const maturityDate = parseMaturityText(row.maturityText);
  const maturityYear = maturityDate ? maturityDate.getUTCFullYear() : null;
  const couponDecimal = couponToDecimal(row.couponText);
  const yieldJualDecimal = row.yieldMbiJual != null ? row.yieldMbiJual / 100 : null;

  let modifiedDuration: number | null = null;
  let rateHike: number | null = null;
  let rateCut: number | null = null;
  let rateHikePrice: number | null = null;
  let rateCutPrice: number | null = null;
  let totalYearToMaturity: number | null = null;
  let priceIfYieldHike: number | null = null;
  let priceIfYieldCut: number | null = null;

  if (maturityDate) {
    totalYearToMaturity = calcYearsToMaturity(maturityDate, params.base);
    if (couponDecimal != null && yieldJualDecimal != null) {
      modifiedDuration = calcDuration(couponDecimal, yieldJualDecimal, maturityDate, params.settlement)?.modified ?? null;
      rateHike = calcRateImpact(yieldJualDecimal, params.cutRate, true);
      rateCut = calcRateImpact(yieldJualDecimal, params.cutRate, false);
      if (row.mbiJual != null) {
        rateHikePrice = Math.round((row.mbiJual + rateHike * row.mbiJual) * 1e6) / 1e6;
        rateCutPrice = Math.round((row.mbiJual + rateCut * row.mbiJual) * 1e6) / 1e6;
      }
      if (totalYearToMaturity != null && totalYearToMaturity > 0) {
        priceIfYieldHike = calcPriceFromYield(couponDecimal, yieldJualDecimal + params.yieldHike / 100, totalYearToMaturity);
        priceIfYieldCut = calcPriceFromYield(couponDecimal, yieldJualDecimal - params.yieldCut / 100, totalYearToMaturity);
      }
    }
  }

  return {
    row,
    currency,
    bondType,
    maturityDate,
    maturityYear,
    modifiedDuration,
    rateHike,
    rateCut,
    rateHikePrice,
    rateCutPrice,
    totalYearToMaturity,
    priceIfYieldHike,
    priceIfYieldCut,
  };
}

export default function PriceIndicationPage() {
  const [priceSheet, setPriceSheet] = useState<PriceSheet | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("Semua");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Simulation parameters (mirrors main.py::render_simulation_inputs).
  const today = useMemo(() => toDateInputValue(new Date()), []);
  const [settlementDate, setSettlementDate] = useState(today);
  const [cutRateInput, setCutRateInput] = useState("0.25");
  const [baseDateInput, setBaseDateInput] = useState(today);
  const [yieldHikeInput, setYieldHikeInput] = useState("0");
  const [yieldCutInput, setYieldCutInput] = useState("0");

  // Styled-table filters (mirrors ui_components.py::render_styled_table).
  const [thresholdPrice, setThresholdPrice] = useState("100");
  const [tableCurrencyFilter, setTableCurrencyFilter] = useState<CurrencyFilter>("Semua");
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  // Yield curve chart state (mirrors ui_components.py::render_yield_curve).
  const [chartCurrencyFilter, setChartCurrencyFilter] = useState<CurrencyFilter>("Semua");
  const [idrKonvSelected, setIdrKonvSelected] = useState<string[]>([]);
  const [idrSyariahSelected, setIdrSyariahSelected] = useState<string[]>([]);
  const [usdSelected, setUsdSelected] = useState<string[]>([]);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/price-quotes/parse", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error ?? "Gagal membaca file.");
        setPriceSheet(null);
        return;
      }
      setPriceSheet(data);
      setQuery("");
      setSectionFilter("Semua");
    } catch {
      setUploadError("Gagal menghubungi server.");
    } finally {
      setUploading(false);
    }
  }

  const sections = useMemo(() => {
    if (!priceSheet) return [];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const row of priceSheet.rows) {
      if (row.section && !seen.has(row.section)) {
        seen.add(row.section);
        ordered.push(row.section);
      }
    }
    return ordered;
  }, [priceSheet]);

  const filteredRows = useMemo(() => {
    if (!priceSheet) return [];
    const q = query.trim().toLowerCase();
    return priceSheet.rows.filter((row) => {
      if (sectionFilter !== "Semua" && row.section !== sectionFilter) return false;
      if (q && !row.productCode.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [priceSheet, query, sectionFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, PriceQuoteRow[]>();
    for (const row of filteredRows) {
      const key = row.section || "Lainnya";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    return map;
  }, [filteredRows]);

  const benchmarkCount = priceSheet?.rows.filter((r) => r.isBenchmark).length ?? 0;

  // --- Simulation columns (MDURATION, Rate Hike/Cut, Price if Yield Hike/Cut) ---
  const rowCalcs = useMemo(() => {
    if (!priceSheet) return [];
    const params: SimParams = {
      settlement: new Date(settlementDate),
      base: new Date(baseDateInput),
      cutRate: Number(cutRateInput) || 0,
      yieldHike: Number(yieldHikeInput) || 0,
      yieldCut: Number(yieldCutInput) || 0,
    };
    return priceSheet.rows.map((row) => computeRow(row, params));
  }, [priceSheet, settlementDate, baseDateInput, cutRateInput, yieldHikeInput, yieldCutInput]);

  const tableRows = useMemo(() => {
    const threshold = Number(thresholdPrice);
    return rowCalcs.filter((rc) => {
      if (tableCurrencyFilter !== "Semua" && rc.currency !== tableCurrencyFilter) return false;
      if (rc.row.mbiJual == null) return false;
      if (Number.isFinite(threshold) && rc.row.mbiJual > threshold) return false;
      return true;
    });
  }, [rowCalcs, tableCurrencyFilter, thresholdPrice]);

  const yearRange = useMemo(() => {
    const years = tableRows.map((r) => r.maturityYear).filter((y): y is number => y != null);
    if (years.length === 0) return null;
    return { min: Math.min(...years), max: Math.max(...years) };
  }, [tableRows]);

  async function handleCopyTable() {
    const header = ["product_code", "type", "kupon", "Maturity", "mbi_beli", "yield_mbi_beli", "mbi_jual", "yield_mbi_jual", "1D"];
    const lines = [header.join("\t")];
    for (const rc of tableRows) {
      const r = rc.row;
      lines.push(
        [r.productCode, r.type, r.couponText, r.maturityText, r.mbiBeli ?? "", r.yieldMbiBeli ?? "", r.mbiJual ?? "", r.yieldMbiJual ?? "", r.oneDay ?? ""].join(
          "\t"
        )
      );
    }
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyStatus("Tersalin.");
    } catch {
      setCopyStatus("Gagal menyalin — browser memblokir akses clipboard.");
    } finally {
      setTimeout(() => setCopyStatus(null), 2000);
    }
  }

  // --- Yield curve chart data ---
  const chartOptions = useMemo(() => {
    if (!priceSheet) return null;
    const codes = [...new Set(priceSheet.rows.map((r) => r.productCode))];
    const benchmarkSet = new Set(priceSheet.rows.filter((r) => r.isBenchmark).map((r) => r.productCode));
    const idrKonv = codes.filter((c) => classifyCurrency(c) === "IDR" && classifyBondType(c) === "Konvensional");
    const idrSyariah = codes.filter((c) => classifyCurrency(c) === "IDR" && classifyBondType(c) === "Syariah");
    const usd = codes.filter((c) => classifyCurrency(c) === "USD");
    return {
      idrKonv,
      idrSyariah,
      usd,
      idrKonvDefault: idrKonv.filter((c) => benchmarkSet.has(c)),
      idrSyariahDefault: idrSyariah.filter((c) => benchmarkSet.has(c)),
      usdDefault: usd.filter((c) => benchmarkSet.has(c)),
    };
  }, [priceSheet]);

  // Re-seed benchmark defaults whenever a fresh sheet is parsed. Uses the "adjust
  // state during render" pattern (not an effect) since this is a synchronous
  // derivation from already-available state, matching switching/page.tsx.
  const chartKey = priceSheet ? `${priceSheet.asOfDate}::${priceSheet.rows.length}` : null;
  const [syncedChartKey, setSyncedChartKey] = useState<string | null>(null);
  if (chartOptions && chartKey !== syncedChartKey) {
    setSyncedChartKey(chartKey);
    setIdrKonvSelected(chartOptions.idrKonvDefault);
    setIdrSyariahSelected(chartOptions.idrSyariahDefault);
    setUsdSelected(chartOptions.usdDefault);
  }

  function pointFor(code: string): ScatterPoint | null {
    const row = priceSheet?.rows.find((r) => r.productCode === code);
    if (!row) return null;
    const maturity = parseMaturityText(row.maturityText);
    if (!maturity || row.yieldMbiJual == null) return null;
    return { code, year: maturity.getUTCFullYear(), yieldPct: row.yieldMbiJual };
  }

  const chartPoints: ScatterPoint[] = useMemo(() => {
    if (!priceSheet) return [];
    return priceSheet.rows
      .filter((r) => chartCurrencyFilter === "Semua" || classifyCurrency(r.productCode) === chartCurrencyFilter)
      .map((r) => {
        const maturity = parseMaturityText(r.maturityText);
        if (!maturity || r.yieldMbiJual == null) return null;
        return { code: r.productCode, year: maturity.getUTCFullYear(), yieldPct: r.yieldMbiJual };
      })
      .filter((p): p is ScatterPoint => p !== null);
  }, [priceSheet, chartCurrencyFilter]);

  const benchmarkCurves: BenchmarkCurve[] = useMemo(() => {
    const curves: BenchmarkCurve[] = [];
    if (chartCurrencyFilter === "Semua" || chartCurrencyFilter === "IDR") {
      curves.push({ label: "Benchmark IDR Konvensional", color: "#dc2626", points: idrKonvSelected.map(pointFor).filter((p): p is ScatterPoint => p !== null) });
      curves.push({ label: "Benchmark IDR Syariah", color: "#16a34a", points: idrSyariahSelected.map(pointFor).filter((p): p is ScatterPoint => p !== null) });
    }
    if (chartCurrencyFilter === "Semua" || chartCurrencyFilter === "USD") {
      curves.push({ label: "Benchmark USD", color: "#ea580c", points: usdSelected.map(pointFor).filter((p): p is ScatterPoint => p !== null) });
    }
    return curves.filter((c) => c.points.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chartCurrencyFilter, idrKonvSelected, idrSyariahSelected, usdSelected, priceSheet]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">Indikasi Harga</p>
        <h1 className="text-xl font-semibold text-ink">Bond Price Indication</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Upload PDF &quot;BOND PRICE INDICATION&quot; Maybank untuk melihat tabel harga, simulasi MDURATION/rate
          shock, dan kurva yield per seri — mengikuti tool referensi (Bonds-Excel).
        </p>
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Upload Tabel Indikasi Harga</h2>
            <p className="mt-0.5 text-xs text-ink-muted">File PDF harian yang dikirim treasury.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <PrimaryButton type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? "Membaca PDF..." : "Upload PDF"}
            </PrimaryButton>
          </div>
        </div>
        {uploadError && <p className="mt-3 text-sm text-negative">{uploadError}</p>}
        {priceSheet && (
          <p className="mt-3 text-sm text-positive">
            Terbaca {priceSheet.rows.length} baris ({benchmarkCount} benchmark, {priceSheet.rows.length - benchmarkCount} non-benchmark)
            {priceSheet.asOfDate ? ` per ${priceSheet.asOfDate}` : ""}.
          </p>
        )}
      </Panel>

      {!priceSheet && <EmptyState message="Upload PDF indikasi harga untuk menampilkan tabel." />}

      {priceSheet && (
        <>
          {/* --- Simulation parameters --- */}
          <div>
            <SectionHeader index={1}>Pengaturan Parameter Simulasi</SectionHeader>
            <Panel className="grid gap-3 p-3 sm:grid-cols-5">
              <LabeledInput label="Tanggal Settlement">
                <TextInput type="date" value={settlementDate} onChange={(e) => setSettlementDate(e.target.value)} />
              </LabeledInput>
              <LabeledInput label="Cut / Hike Rate (%)">
                <TextInput type="number" step="0.01" value={cutRateInput} onChange={(e) => setCutRateInput(e.target.value)} />
              </LabeledInput>
              <LabeledInput label="Tanggal Basis (Hari Ini)">
                <TextInput type="date" value={baseDateInput} onChange={(e) => setBaseDateInput(e.target.value)} />
              </LabeledInput>
              <LabeledInput label="Yield Naik (%)">
                <TextInput type="number" step="0.01" value={yieldHikeInput} onChange={(e) => setYieldHikeInput(e.target.value)} />
              </LabeledInput>
              <LabeledInput label="Yield Turun (%)">
                <TextInput type="number" step="0.01" value={yieldCutInput} onChange={(e) => setYieldCutInput(e.target.value)} />
              </LabeledInput>
            </Panel>
            <p className="mt-1.5 text-[11px] text-ink-faint">
              MDURATION dan PV dihitung dengan asumsi kupon semi-annual, Actual/Actual (PDF tidak memberi frekuensi
              kupon asli obligasi) — mengikuti simplifikasi yang sama dengan tool referensi. Untuk perhitungan
              presisi per-obligasi (frekuensi & basis asli), gunakan kalkulator Subscription/Redemption.
            </p>
          </div>

          {/* --- Styled table with threshold/currency filters --- */}
          <div>
            <SectionHeader index={2}>Tabel dengan Gradasi Warna</SectionHeader>
            <Panel className="space-y-3 p-3">
              <div className="flex flex-wrap items-end gap-3">
                <LabeledInput label="Threshold Price (MBI Jual &le;)">
                  <TextInput type="number" step="0.01" value={thresholdPrice} onChange={(e) => setThresholdPrice(e.target.value)} className="w-32" />
                </LabeledInput>
                <LabeledInput label="Filter Mata Uang">
                  <Select value={tableCurrencyFilter} onChange={(e) => setTableCurrencyFilter(e.target.value as CurrencyFilter)} className="w-32">
                    <option value="Semua">Semua</option>
                    <option value="IDR">IDR</option>
                    <option value="USD">USD</option>
                  </Select>
                </LabeledInput>
                <SecondaryButton type="button" onClick={handleCopyTable}>
                  Copy Tabel
                </SecondaryButton>
                {copyStatus && <span className="text-xs text-ink-muted">{copyStatus}</span>}
                <span className="ml-auto text-xs text-ink-muted">{tableRows.length} baris</span>
              </div>
              <StyledTable rows={tableRows} yearRange={yearRange} />
            </Panel>
          </div>

          {/* --- Interactive yield curve --- */}
          <div>
            <SectionHeader index={3}>Kurva Yield (Mark to Market)</SectionHeader>
            <Panel className="space-y-3 p-3">
              <div>
                <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">Filter Mata Uang Grafik</p>
                <div className="flex gap-4 text-sm">
                  {(["Semua", "IDR", "USD"] as CurrencyFilter[]).map((c) => (
                    <label key={c} className="flex items-center gap-1.5">
                      <input type="radio" name="chart-currency" checked={chartCurrencyFilter === c} onChange={() => setChartCurrencyFilter(c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {chartOptions && (chartCurrencyFilter === "Semua" || chartCurrencyFilter === "IDR") && (
                  <MultiSelectBox
                    label="Benchmark IDR Konvensional"
                    options={chartOptions.idrKonv}
                    selected={idrKonvSelected}
                    onChange={setIdrKonvSelected}
                    accentColor="#dc2626"
                  />
                )}
                {chartOptions && (chartCurrencyFilter === "Semua" || chartCurrencyFilter === "IDR") && (
                  <MultiSelectBox
                    label="Benchmark IDR Syariah"
                    options={chartOptions.idrSyariah}
                    selected={idrSyariahSelected}
                    onChange={setIdrSyariahSelected}
                    accentColor="#16a34a"
                  />
                )}
                {chartOptions && (chartCurrencyFilter === "Semua" || chartCurrencyFilter === "USD") && (
                  <MultiSelectBox label="Benchmark USD" options={chartOptions.usd} selected={usdSelected} onChange={setUsdSelected} accentColor="#ea580c" />
                )}
              </div>

              {chartPoints.length > 0 ? (
                <BenchmarkYieldChart points={chartPoints} benchmarks={benchmarkCurves} />
              ) : (
                <EmptyState message="Tidak ada seri dengan tenor & yield valid untuk digambar." />
              )}

              {benchmarkCurves.length > 0 && (
                <div>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Tabel Ringkasan Benchmark</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {benchmarkCurves.map((curve) => (
                      <div key={curve.label} className="border border-border">
                        <div className="px-2.5 py-1.5" style={{ borderBottom: `2px solid ${curve.color}` }}>
                          <span className="text-xs font-semibold text-ink">{curve.label}</span>
                        </div>
                        <table className="w-full text-[11px]">
                          <tbody>
                            {[...curve.points]
                              .sort((a, b) => a.year - b.year)
                              .map((p) => (
                                <tr key={p.code} className="border-b border-border last:border-0">
                                  <td className="px-2.5 py-1 font-medium text-ink">{p.code}</td>
                                  <td className="num px-2.5 py-1 text-right text-ink-muted">{p.year}</td>
                                  <td className="num px-2.5 py-1 text-right text-ink">{formatNumber(p.yieldPct, 2)}%</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          </div>

          {/* --- Raw parsed table, grouped exactly as the PDF's own sections --- */}
          <div>
            <SectionHeader index={4}>Tabel Mentah (Sesuai Section PDF)</SectionHeader>
            <Panel className="space-y-3 p-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="w-52">
                  <TextInput placeholder="Cari kode produk..." value={query} onChange={(e) => setQuery(e.target.value)} />
                </div>
                <div className="w-64">
                  <Select value={sectionFilter} onChange={(e) => setSectionFilter(e.target.value)}>
                    <option value="Semua">Semua Section ({priceSheet.rows.length})</option>
                    {sections.map((s) => (
                      <option key={s} value={s}>
                        {s} ({priceSheet.rows.filter((r) => r.section === s).length})
                      </option>
                    ))}
                  </Select>
                </div>
                <span className="text-xs text-ink-muted">{filteredRows.length} baris ditampilkan</span>
              </div>

              {filteredRows.length === 0 ? (
                <EmptyState message="Tidak ada baris yang cocok dengan pencarian/filter." />
              ) : (
                <div className="space-y-5">
                  {[...grouped.entries()].map(([section, rows]) => (
                    <div key={section}>
                      <div className="flex items-center gap-2 bg-accent px-3 py-1.5">
                        <h2 className="text-[11px] font-semibold uppercase tracking-wide text-accent-ink">{section}</h2>
                        <Pill tone={rows[0]?.isBenchmark ? "accent" : "neutral"}>{rows[0]?.isBenchmark ? "BENCHMARK" : "NON BENCHMARK"}</Pill>
                      </div>
                      <div className="overflow-hidden border border-t-0 border-border">
                        <Table>
                          <Thead>
                            <tr>
                              <th className="px-3 py-2 text-left">Prod Code</th>
                              <th className="px-3 py-2 text-left">Type</th>
                              <th className="px-3 py-2 text-right">Kupon</th>
                              <th className="px-3 py-2 text-right">Maturity</th>
                              <th className="px-3 py-2 text-right">MBI Beli</th>
                              <th className="px-3 py-2 text-right">Yield Beli</th>
                              <th className="px-3 py-2 text-right">MBI Jual</th>
                              <th className="px-3 py-2 text-right">Yield Jual</th>
                              <th className="px-3 py-2 text-right">1D</th>
                            </tr>
                          </Thead>
                          <tbody>
                            {rows.map((row, i) => (
                              <tr key={`${row.productCode}-${i}`} className="border-b border-border last:border-0 hover:bg-surface-2">
                                <td className="num px-3 py-1.5 font-semibold text-ink">{row.productCode}</td>
                                <td className="px-3 py-1.5 text-ink-muted">{row.type || "—"}</td>
                                <td className="num px-3 py-1.5 text-right text-ink">{row.couponText}</td>
                                <td className="num px-3 py-1.5 text-right text-ink-muted">{row.maturityText}</td>
                                <td className="num px-3 py-1.5 text-right text-ink">{row.mbiBeli != null ? formatNumber(row.mbiBeli, 2) : "—"}</td>
                                <td className="num px-3 py-1.5 text-right text-ink-muted">
                                  {row.yieldMbiBeli != null ? `${formatNumber(row.yieldMbiBeli, 2)}%` : "—"}
                                </td>
                                <td className="num px-3 py-1.5 text-right text-ink">
                                  {row.mbiJual != null && row.mbiJual !== 0 ? formatNumber(row.mbiJual, 2) : "—"}
                                </td>
                                <td className="num px-3 py-1.5 text-right text-ink-muted">
                                  {row.yieldMbiJual != null && row.mbiJual ? `${formatNumber(row.yieldMbiJual, 2)}%` : "—"}
                                </td>
                                <td className="px-3 py-1.5 text-right">
                                  <OneDayChange value={row.oneDay} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </Table>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

function LabeledInput({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-ink-muted">{label}</span>
      {children}
    </label>
  );
}

function OneDayChange({ value }: { value: number | null }) {
  if (value == null) return <span className="num text-ink-faint">—</span>;
  if (value > 0) return <span className="num font-semibold text-positive">&#9650; {formatNumber(value, 2)}</span>;
  if (value < 0) return <span className="num font-semibold text-negative">&#9660; {formatNumber(Math.abs(value), 2)}</span>;
  return <span className="num text-ink-faint">&#9644; 0.00</span>;
}

/** background/text tint for the 1D column, matching bond_utils.py::style_change_cell's semantics (red/green/amber). */
function changeCellStyle(value: number | null): React.CSSProperties {
  if (value == null) return {};
  if (value < 0) return { background: "var(--negative-soft)", color: "var(--negative)" };
  if (value > 0) return { background: "var(--positive-soft)", color: "var(--positive)" };
  return { background: "var(--warning-soft)", color: "var(--warning)" };
}

/** Sequential blue tint for the maturity-year column, matching render_styled_table's Blues background_gradient. */
function yearCellStyle(year: number | null, range: { min: number; max: number } | null): React.CSSProperties {
  if (year == null || !range || range.max <= range.min) return {};
  const t = (year - range.min) / (range.max - range.min);
  return { background: `rgba(37, 99, 235, ${0.06 + t * 0.28})` };
}

function StyledTable({ rows, yearRange }: { rows: RowCalc[]; yearRange: { min: number; max: number } | null }) {
  if (rows.length === 0) return <EmptyState message="Tidak ada baris yang cocok dengan threshold/filter." />;
  return (
    <Table>
      <Thead>
        <tr>
          <th className="px-2.5 py-2 text-left">product_code</th>
          <th className="px-2.5 py-2 text-left">type</th>
          <th className="px-2.5 py-2 text-right">Maturity</th>
          <th className="px-2.5 py-2 text-right">mbi_beli</th>
          <th className="px-2.5 py-2 text-right">mbi_jual</th>
          <th className="px-2.5 py-2 text-right">1D</th>
          <th className="px-2.5 py-2 text-left">currency check</th>
          <th className="px-2.5 py-2 text-right">year maturity</th>
          <th className="px-2.5 py-2 text-right">kupon %</th>
          <th className="px-2.5 py-2 text-right">y mbi beli</th>
          <th className="px-2.5 py-2 text-right">y mbi jual</th>
          <th className="px-2.5 py-2 text-right">MDURATION</th>
          <th className="px-2.5 py-2 text-right">Rate Hike</th>
          <th className="px-2.5 py-2 text-right">Rate Cut</th>
          <th className="px-2.5 py-2 text-right">Rate Hike Price</th>
          <th className="px-2.5 py-2 text-right">Rate Cut Price</th>
          <th className="px-2.5 py-2 text-right">Total Yr to Maturity</th>
          <th className="px-2.5 py-2 text-right">Price if Yield Hike</th>
          <th className="px-2.5 py-2 text-right">Price if Yield Cut</th>
        </tr>
      </Thead>
      <tbody>
        {rows.map((rc, i) => {
          const r = rc.row;
          return (
            <tr key={`${r.productCode}-${i}`} className="border-b border-border last:border-0 hover:bg-surface-2">
              <td className="num px-2.5 py-1.5 font-semibold text-ink">{r.productCode}</td>
              <td className="px-2.5 py-1.5 text-ink-muted">{r.type || "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink-muted">{r.maturityText}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{r.mbiBeli != null ? formatNumber(r.mbiBeli, 2) : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{formatNumber(r.mbiJual!, 2)}</td>
              <td className="num px-2.5 py-1.5 text-right" style={changeCellStyle(r.oneDay)}>
                {r.oneDay != null ? formatNumber(r.oneDay, 2) : "—"}
              </td>
              <td className="px-2.5 py-1.5 text-ink-muted">{rc.currency}</td>
              <td className="num px-2.5 py-1.5 text-right" style={yearCellStyle(rc.maturityYear, yearRange)}>
                {rc.maturityYear ?? "—"}
              </td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{r.couponText}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink-muted">{r.yieldMbiBeli != null ? `${formatNumber(r.yieldMbiBeli, 2)}%` : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{r.yieldMbiJual != null ? `${formatNumber(r.yieldMbiJual, 2)}%` : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{rc.modifiedDuration != null ? formatNumber(rc.modifiedDuration, 4) : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink-muted">{rc.rateHike != null ? formatNumber(rc.rateHike, 6) : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink-muted">{rc.rateCut != null ? formatNumber(rc.rateCut, 6) : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{rc.rateHikePrice != null ? formatNumber(rc.rateHikePrice, 4) : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{rc.rateCutPrice != null ? formatNumber(rc.rateCutPrice, 4) : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink-muted">{rc.totalYearToMaturity != null ? formatNumber(rc.totalYearToMaturity, 4) : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{rc.priceIfYieldHike != null ? formatNumber(rc.priceIfYieldHike, 4) : "—"}</td>
              <td className="num px-2.5 py-1.5 text-right text-ink">{rc.priceIfYieldCut != null ? formatNumber(rc.priceIfYieldCut, 4) : "—"}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}

function MultiSelectBox({
  label,
  options,
  selected,
  onChange,
  accentColor,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
  accentColor: string;
}) {
  const [query, setQuery] = useState("");
  const filtered = options.filter((o) => !selected.includes(o) && o.toLowerCase().includes(query.toLowerCase()));

  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }

  return (
    <div className="border border-border">
      <div className="px-2.5 py-1.5" style={{ borderBottom: `2px solid ${accentColor}` }}>
        <p className="text-[10px] font-semibold uppercase tracking-wide text-ink">{label}</p>
      </div>
      <div className="p-2">
        <div className="mb-1.5 flex min-h-[22px] flex-wrap gap-1">
          {selected.length === 0 && <span className="text-[11px] text-ink-faint">Belum ada seri dipilih.</span>}
          {selected.map((code) => (
            <button
              key={code}
              type="button"
              onClick={() => toggle(code)}
              className="border px-1.5 py-0.5 text-[10px] font-medium"
              style={{ borderColor: `${accentColor}66`, color: accentColor, background: `${accentColor}14` }}
            >
              {code} &times;
            </button>
          ))}
        </div>
        <TextInput placeholder="Cari & tambah seri..." value={query} onChange={(e) => setQuery(e.target.value)} className="mb-1.5" />
        <div className="max-h-28 overflow-y-auto border border-border bg-surface">
          {filtered.slice(0, 60).map((o) => (
            <button key={o} type="button" onClick={() => toggle(o)} className="block w-full px-2 py-1 text-left text-[11px] text-ink hover:bg-surface-2">
              {o}
            </button>
          ))}
          {filtered.length === 0 && <p className="px-2 py-1 text-[11px] text-ink-faint">Tidak ada seri lain.</p>}
        </div>
      </div>
    </div>
  );
}
