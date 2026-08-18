"use client";

import { useMemo, useRef, useState } from "react";
import type { PriceQuoteRow } from "@/lib/priceQuoteParser";
import { parseAsOfDate, parseMaturityText } from "@/lib/priceQuoteParser";
import { formatNumber } from "@/lib/format";
import { Panel, PrimaryButton, Pill, EmptyState, TextInput, Select, Table, Thead } from "@/components/ui";
import { YieldCurveChart, type YieldCurvePoint } from "@/components/YieldCurveChart";

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

interface PriceSheet {
  asOfDate: string | null;
  rows: PriceQuoteRow[];
}

export default function PriceIndicationPage() {
  const [priceSheet, setPriceSheet] = useState<PriceSheet | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [sectionFilter, setSectionFilter] = useState("Semua");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const curves = useMemo(() => {
    if (!priceSheet) return [];
    const asOf = parseAsOfDate(priceSheet.asOfDate) ?? new Date();
    return sections
      .map((section) => {
        const points: YieldCurvePoint[] = priceSheet.rows
          .filter((r) => r.section === section)
          .map((r) => {
            const maturity = parseMaturityText(r.maturityText);
            if (!maturity) return null;
            const years = (maturity.getTime() - asOf.getTime()) / MS_PER_YEAR;
            if (years <= 0) return null;
            const beli = r.mbiBeli != null && r.yieldMbiBeli != null ? r.yieldMbiBeli : null;
            const jual = r.mbiJual && r.yieldMbiJual != null ? r.yieldMbiJual : null;
            if (beli == null && jual == null) return null;
            return { code: r.productCode, years, beli, jual };
          })
          .filter((p): p is YieldCurvePoint => p !== null);
        return { section, points };
      })
      .filter((c) => c.points.length >= 2);
  }, [priceSheet, sections]);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">Indikasi Harga</p>
        <h1 className="text-xl font-semibold text-ink">Bond Price Indication</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Upload PDF &quot;BOND PRICE INDICATION&quot; Maybank untuk melihat seluruh tabel harga MBI Beli/Jual per
          seri, dikelompokkan sesuai section aslinya (Benchmark, Non Benchmark, Retail).
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

      {priceSheet && curves.length > 0 && (
        <div>
          <div className="bg-accent px-3 py-1.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-accent-ink">Kurva Yield per Section</h2>
          </div>
          <Panel className="grid gap-x-4 gap-y-2 p-2 sm:grid-cols-2">
            {curves.map((c) => (
              <div key={c.section} className="border border-border">
                <YieldCurveChart title={c.section} points={c.points} />
              </div>
            ))}
          </Panel>
          <p className="mt-2 text-[11px] text-ink-faint">
            Ditampilkan hanya section dengan &ge;2 seri bertenor valid. Sumbu-X = sisa tenor (tahun) dari tanggal
            &quot;as of&quot; PDF; sumbu-Y = yield MBI Beli/Jual.
          </p>
        </div>
      )}

      {priceSheet && (
        <>
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
                    <Pill tone={rows[0]?.isBenchmark ? "accent" : "neutral"}>
                      {rows[0]?.isBenchmark ? "BENCHMARK" : "NON BENCHMARK"}
                    </Pill>
                  </div>
                  <Panel className="overflow-hidden">
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
                            <td className="num px-3 py-1.5 text-right text-ink">{row.mbiJual != null && row.mbiJual !== 0 ? formatNumber(row.mbiJual, 2) : "—"}</td>
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
                  </Panel>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function OneDayChange({ value }: { value: number | null }) {
  if (value == null) return <span className="num text-ink-faint">—</span>;
  if (value > 0) return <span className="num font-semibold text-positive">&#9650; {formatNumber(value, 2)}</span>;
  if (value < 0) return <span className="num font-semibold text-negative">&#9660; {formatNumber(Math.abs(value), 2)}</span>;
  return <span className="num text-ink-faint">&#9644; 0.00</span>;
}
