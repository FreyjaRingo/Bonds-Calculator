"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BondCombobox } from "@/components/BondCombobox";
import type { BondDTO } from "@/lib/types";
import { bondDtoToInput } from "@/lib/types";
import { calcSwitching, type SwitchingResult } from "@/lib/switching";
import { workday, holidaySet, type Holiday } from "@/lib/finance";
import { matchBondByCode } from "@/lib/bondCodeMatch";
import type { PriceQuoteRow } from "@/lib/priceQuoteParser";
import { formatCurrency, formatDate, formatNumber, formatPercent, toDateInputValue } from "@/lib/format";
import {
  Field,
  TextInput,
  PrimaryButton,
  SecondaryButton,
  Panel,
  SectionHeader,
  SectionPanel,
  Stat,
  Pill,
  VerdictBanner,
  EmptyState,
  ErrorState,
  Table,
  Thead,
  type Tone,
} from "@/components/ui";

type SwitchingMode = "recommend" | "specific";

export default function SwitchingPage() {
  const [mode, setMode] = useState<SwitchingMode>("recommend");
  const [priceSheet, setPriceSheet] = useState<{ asOfDate: string | null; rows: PriceQuoteRow[] } | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [oldBond, setOldBond] = useState<BondDTO | null>(null);
  const [originalNominal, setOriginalNominal] = useState("100000000");
  const [originalBuyTradeDate, setOriginalBuyTradeDate] = useState("");
  const [originalBuySettlementDate, setOriginalBuySettlementDate] = useState("");
  const [originalBuyPrice, setOriginalBuyPrice] = useState("100");

  const [todayTradeDate, setTodayTradeDate] = useState(toDateInputValue(new Date()));
  const [oldBondSellSettlementDate, setOldBondSellSettlementDate] = useState("");
  const [oldBondSellPriceToday, setOldBondSellPriceToday] = useState("");
  const [oldBondRebuyPriceToday, setOldBondRebuyPriceToday] = useState("");

  const [newBond, setNewBond] = useState<BondDTO | null>(null);
  const [newBondBuyPriceToday, setNewBondBuyPriceToday] = useState("");

  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    const markets = new Set<string>();
    if (oldBond) markets.add(oldBond.currency);
    if (newBond) markets.add(newBond.currency);
    if (markets.size === 0) return;
    Promise.all(
      [...markets].map((m) =>
        fetch(`/api/holidays?market=${m}`)
          .then((r) => r.json())
          .then((data: { date: string; market: "IDR" | "USD" }[]) => data)
      )
    ).then((results) => setHolidays(results.flat().map((h) => ({ date: new Date(h.date), market: h.market }))));
  }, [oldBond, newBond]);

  // Auto-fill today's prices from the uploaded price sheet when a bond is picked/matched.
  // Uses the "adjust state during render" pattern (not an effect) since this is a
  // synchronous derivation from already-available state, not a subscription to an
  // external system.
  const oldAutoFillKey = oldBond && priceSheet ? `${oldBond.id}::${priceSheet.rows.length}` : null;
  const [syncedOldAutoFillKey, setSyncedOldAutoFillKey] = useState<string | null>(null);
  if (oldAutoFillKey && oldAutoFillKey !== syncedOldAutoFillKey) {
    setSyncedOldAutoFillKey(oldAutoFillKey);
    const match = priceSheet!.rows.find((r) => matchBondByCode(r.productCode, [oldBond!])?.id === oldBond!.id);
    if (match?.mbiBeli != null) setOldBondSellPriceToday(String(match.mbiBeli));
    if (match?.mbiJual != null) setOldBondRebuyPriceToday(String(match.mbiJual));
  }

  const newAutoFillKey = newBond && priceSheet ? `${newBond.id}::${priceSheet.rows.length}` : null;
  const [syncedNewAutoFillKey, setSyncedNewAutoFillKey] = useState<string | null>(null);
  if (newAutoFillKey && newAutoFillKey !== syncedNewAutoFillKey) {
    setSyncedNewAutoFillKey(newAutoFillKey);
    const match = priceSheet!.rows.find((r) => matchBondByCode(r.productCode, [newBond!])?.id === newBond!.id);
    if (match?.mbiJual != null) setNewBondBuyPriceToday(String(match.mbiJual));
  }

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
    } catch {
      setUploadError("Gagal menghubungi server.");
    } finally {
      setUploading(false);
    }
  }

  function suggestSettlement(bond: BondDTO | null, tradeDate: string, setter: (v: string) => void) {
    if (!bond || !tradeDate) return;
    const settle = workday(new Date(tradeDate), 2, holidaySet(holidays, bond.currency));
    setter(toDateInputValue(settle));
  }

  const result = useMemo(() => {
    if (!oldBond || !newBond) return null;
    const nominalNum = Number(originalNominal);
    const origPriceNum = Number(originalBuyPrice);
    const sellPriceNum = Number(oldBondSellPriceToday);
    const buyPriceNum = Number(newBondBuyPriceToday);
    if (![nominalNum, origPriceNum, sellPriceNum, buyPriceNum].every((n) => Number.isFinite(n) && n > 0)) return null;
    if (!originalBuyTradeDate || !originalBuySettlementDate || !todayTradeDate || !oldBondSellSettlementDate) return null;

    return calcSwitching(
      {
        oldBond: bondDtoToInput(oldBond),
        originalNominal: nominalNum,
        originalBuyTradeDate: new Date(originalBuyTradeDate),
        originalBuySettlementDate: new Date(originalBuySettlementDate),
        originalBuyPrice: origPriceNum,
        todayTradeDate: new Date(todayTradeDate),
        oldBondSellSettlementDate: new Date(oldBondSellSettlementDate),
        oldBondSellPriceToday: sellPriceNum,
        newBond: bondDtoToInput(newBond),
        newBondBuyPriceToday: buyPriceNum,
        oldBondRebuyPriceToday: Number(oldBondRebuyPriceToday) > 0 ? Number(oldBondRebuyPriceToday) : undefined,
      },
      holidays
    );
  }, [
    oldBond,
    newBond,
    originalNominal,
    originalBuyTradeDate,
    originalBuySettlementDate,
    originalBuyPrice,
    todayTradeDate,
    oldBondSellSettlementDate,
    oldBondSellPriceToday,
    oldBondRebuyPriceToday,
    newBondBuyPriceToday,
    holidays,
  ]);

  // --- Opsi 1: rekomendasi otomatis dari seluruh database obligasi ---
  const [allBonds, setAllBonds] = useState<BondDTO[]>([]);
  useEffect(() => {
    fetch("/api/bonds?limit=400")
      .then((r) => r.json())
      .then((data: BondDTO[]) => setAllBonds(data))
      .catch(() => setAllBonds([]));
  }, []);

  const commonInputsReady = useMemo(() => {
    if (!oldBond) return null;
    const nominalNum = Number(originalNominal);
    const origPriceNum = Number(originalBuyPrice);
    const sellPriceNum = Number(oldBondSellPriceToday);
    if (![nominalNum, origPriceNum, sellPriceNum].every((n) => Number.isFinite(n) && n > 0)) return null;
    if (!originalBuyTradeDate || !originalBuySettlementDate || !todayTradeDate || !oldBondSellSettlementDate) return null;
    return { nominalNum, origPriceNum, sellPriceNum };
  }, [oldBond, originalNominal, originalBuyPrice, oldBondSellPriceToday, originalBuyTradeDate, originalBuySettlementDate, todayTradeDate, oldBondSellSettlementDate]);

  const candidates = useMemo<CandidateEval[]>(() => {
    if (!oldBond || !priceSheet || !commonInputsReady || allBonds.length === 0) return [];
    const out: CandidateEval[] = [];
    for (const cand of allBonds) {
      if (cand.id === oldBond.id || cand.currency !== oldBond.currency) continue;
      const priceRow = priceSheet.rows.find((r) => matchBondByCode(r.productCode, [cand])?.id === cand.id);
      if (!priceRow?.mbiJual) continue;
      const res = calcSwitching(
        {
          oldBond: bondDtoToInput(oldBond),
          originalNominal: commonInputsReady.nominalNum,
          originalBuyTradeDate: new Date(originalBuyTradeDate),
          originalBuySettlementDate: new Date(originalBuySettlementDate),
          originalBuyPrice: commonInputsReady.origPriceNum,
          todayTradeDate: new Date(todayTradeDate),
          oldBondSellSettlementDate: new Date(oldBondSellSettlementDate),
          oldBondSellPriceToday: commonInputsReady.sellPriceNum,
          newBond: bondDtoToInput(cand),
          newBondBuyPriceToday: priceRow.mbiJual,
          oldBondRebuyPriceToday: Number(oldBondRebuyPriceToday) > 0 ? Number(oldBondRebuyPriceToday) : undefined,
        },
        holidays
      );
      if (res.ok) out.push({ bond: cand, buyPriceToday: priceRow.mbiJual, data: res.data });
    }
    return out;
  }, [
    oldBond,
    priceSheet,
    commonInputsReady,
    allBonds,
    originalBuyTradeDate,
    originalBuySettlementDate,
    todayTradeDate,
    oldBondSellSettlementDate,
    oldBondRebuyPriceToday,
    holidays,
  ]);

  function pickCandidate(cand: CandidateEval) {
    setNewBond(cand.bond);
    setNewBondBuyPriceToday(String(cand.buyPriceToday));
    setMode("specific");
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">Kalkulator</p>
        <h1 className="text-xl font-semibold text-ink">Switching</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Jual obligasi yang sedang dipegang hari ini, alihkan dananya ke obligasi lain — cek untung/rugi dari sisi
          harga, kupon, dan duration, dibanding tetap hold.
        </p>
      </div>

      <Panel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-ink">Upload Tabel Indikasi Harga</h2>
            <p className="mt-0.5 text-xs text-ink-muted">
              Upload PDF &quot;BOND PRICE INDICATION&quot; untuk auto-isi harga jual/beli hari ini.
            </p>
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
            Terbaca {priceSheet.rows.length} baris harga{priceSheet.asOfDate ? ` per ${priceSheet.asOfDate}` : ""}. Harga
            akan otomatis terisi saat Anda memilih obligasi di bawah (kalau kodenya cocok).
          </p>
        )}
      </Panel>

      <div className="flex border border-border">
        <button
          type="button"
          onClick={() => setMode("recommend")}
          className={`flex-1 px-4 py-2.5 text-sm font-semibold transition-colors ${
            mode === "recommend" ? "bg-accent text-accent-ink" : "bg-surface text-ink-muted hover:bg-surface-2"
          }`}
        >
          Opsi 1 — Cari Rekomendasi
        </button>
        <button
          type="button"
          onClick={() => setMode("specific")}
          className={`flex-1 border-l border-border px-4 py-2.5 text-sm font-semibold transition-colors ${
            mode === "specific" ? "bg-accent text-accent-ink" : "bg-surface text-ink-muted hover:bg-surface-2"
          }`}
        >
          Opsi 2 — Switching ke Obligasi Tertentu
        </button>
      </div>

      <div className={mode === "specific" ? "grid gap-6 lg:grid-cols-2" : "grid gap-6"}>
        <Panel className="space-y-4 p-5">
          <h2 className="text-sm font-semibold text-ink">Obligasi yang Dipegang Sekarang (Jual)</h2>
          <Field label="Obligasi">
            <BondCombobox value={oldBond} onChange={setOldBond} />
          </Field>
          <Field label="Nominal Awal">
            <TextInput type="number" min={0} value={originalNominal} onChange={(e) => setOriginalNominal(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tgl Beli Awal">
              <TextInput
                type="date"
                value={originalBuyTradeDate}
                onChange={(e) => {
                  setOriginalBuyTradeDate(e.target.value);
                  if (!originalBuySettlementDate) suggestSettlement(oldBond, e.target.value, setOriginalBuySettlementDate);
                }}
              />
            </Field>
            <Field label="Settlement Beli Awal">
              <TextInput type="date" value={originalBuySettlementDate} onChange={(e) => setOriginalBuySettlementDate(e.target.value)} />
            </Field>
          </div>
          <Field label="Harga Beli Awal (per 100)">
            <TextInput type="number" min={0} step="0.001" value={originalBuyPrice} onChange={(e) => setOriginalBuyPrice(e.target.value)} />
          </Field>
          {oldBond && <BondSummaryBox bond={oldBond} />}

          <div className="border-t border-border pt-4">
            <Field label="Tanggal Transaksi Switching (hari ini)">
              <TextInput
                type="date"
                value={todayTradeDate}
                onChange={(e) => {
                  setTodayTradeDate(e.target.value);
                  suggestSettlement(oldBond, e.target.value, setOldBondSellSettlementDate);
                }}
              />
            </Field>
            <div className="mt-3">
              <Field label="Settlement Jual Hari Ini">
                <div className="flex gap-2">
                  <TextInput type="date" value={oldBondSellSettlementDate} onChange={(e) => setOldBondSellSettlementDate(e.target.value)} />
                  <SecondaryButton
                    type="button"
                    onClick={() => suggestSettlement(oldBond, todayTradeDate, setOldBondSellSettlementDate)}
                    className="whitespace-nowrap px-2.5 py-0 text-xs"
                  >
                    T+2
                  </SecondaryButton>
                </div>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Harga Jual Hari Ini (MBI Beli, per 100)">
                <TextInput type="number" min={0} step="0.001" value={oldBondSellPriceToday} onChange={(e) => setOldBondSellPriceToday(e.target.value)} />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Harga Beli Kembali Hari Ini (MBI Jual, per 100)">
                <TextInput type="number" min={0} step="0.001" value={oldBondRebuyPriceToday} onChange={(e) => setOldBondRebuyPriceToday(e.target.value)} />
              </Field>
              <p className="mt-1 text-[11px] text-ink-faint">
                Basis pembanding &quot;apple-to-apple&quot; di bagian Pricing — berapa nominal {oldBond?.name ?? "obligasi ini"} yang
                bisa dibeli kembali hari ini dengan dana hasil jual, dibanding nominal obligasi tujuan.
              </p>
            </div>
          </div>
        </Panel>

        {mode === "specific" && (
          <Panel className="space-y-4 p-5">
            <h2 className="text-sm font-semibold text-ink">Obligasi Tujuan Switching (Beli)</h2>
            <Field label="Obligasi">
              <BondCombobox value={newBond} onChange={setNewBond} />
            </Field>
            <Field label="Harga Beli Hari Ini (MBI Jual, per 100)">
              <TextInput type="number" min={0} step="0.001" value={newBondBuyPriceToday} onChange={(e) => setNewBondBuyPriceToday(e.target.value)} />
            </Field>
            <p className="border border-border bg-surface-2 px-3 py-2.5 text-xs text-ink-muted">
              Nominal obligasi baru dihitung otomatis dari dana hasil penjualan obligasi lama (principal + accrued
              interest) dibagi harga beli obligasi baru — bukan nominal yang sama.
            </p>
            {newBond && <BondSummaryBox bond={newBond} />}
          </Panel>
        )}
      </div>

      {mode === "recommend" && (
        <RecommendationTabs oldBond={oldBond} priceSheet={priceSheet} commonInputsReady={!!commonInputsReady} candidates={candidates} onPick={pickCandidate} />
      )}

      {mode === "specific" && (
        <div>
          {(!oldBond || !newBond) && <EmptyState message="Pilih obligasi lama dan obligasi tujuan untuk mulai menghitung." />}
          {oldBond && newBond && !result && <EmptyState message="Lengkapi semua nominal, harga, dan tanggal yang valid." />}
          {oldBond && newBond && result && !result.ok && <ErrorState message={result.error} />}
          {oldBond && newBond && result && result.ok && (
            <ResultView oldBond={oldBond} newBond={newBond} data={result.data} />
          )}
        </div>
      )}
    </div>
  );
}

interface CandidateEval {
  bond: BondDTO;
  buyPriceToday: number;
  data: SwitchingResult;
}

type RecTabKey = "yield" | "kupon" | "bep" | "duration" | "pricing";

const REC_TABS: { key: RecTabKey; label: string }[] = [
  { key: "yield", label: "Yield Tertinggi" },
  { key: "kupon", label: "Kupon Tertinggi" },
  { key: "bep", label: "BEP Tercepat" },
  { key: "duration", label: "Duration Terpendek" },
  { key: "pricing", label: "Untung Pricing" },
];

function sortCandidates(list: CandidateEval[], key: RecTabKey): CandidateEval[] {
  const arr = [...list];
  switch (key) {
    case "yield":
      return arr.sort((a, b) => b.data.newBondSubscription.ytm - a.data.newBondSubscription.ytm);
    case "kupon":
      return arr.sort((a, b) => b.data.couponComparison.newAnnualCoupon - a.data.couponComparison.newAnnualCoupon);
    case "bep":
      return arr.sort((a, b) => {
        const da = a.data.bep.switchScenario.daysFromToday;
        const db = b.data.bep.switchScenario.daysFromToday;
        if (da == null && db == null) return 0;
        if (da == null) return 1;
        if (db == null) return -1;
        return da - db;
      });
    case "duration":
      return arr.sort((a, b) => a.data.durationComparison.newDuration - b.data.durationComparison.newDuration);
    case "pricing":
      return arr.sort((a, b) => (b.data.extraNominalVsRebuy ?? b.data.extraNominal) - (a.data.extraNominalVsRebuy ?? a.data.extraNominal));
  }
}

/**
 * Opsi 1: instead of asking for a specific target bond, evaluate every
 * same-currency bond in the database that has a quoted price today (matched
 * from the uploaded price sheet), then let the user rank the field by
 * whichever criterion matters to them right now -- the same five criteria
 * as the Opsi 2 scorecard, just applied across the whole universe instead of
 * one pair.
 */
function RecommendationTabs({
  oldBond,
  priceSheet,
  commonInputsReady,
  candidates,
  onPick,
}: {
  oldBond: BondDTO | null;
  priceSheet: { asOfDate: string | null; rows: PriceQuoteRow[] } | null;
  commonInputsReady: boolean;
  candidates: CandidateEval[];
  onPick: (c: CandidateEval) => void;
}) {
  const [tab, setTab] = useState<RecTabKey>("yield");

  if (!oldBond) return <EmptyState message="Pilih obligasi yang dipegang sekarang untuk mulai mencari rekomendasi." />;
  if (!priceSheet) return <EmptyState message="Upload tabel indikasi harga (PDF) untuk mencari kandidat switching hari ini." />;
  if (!commonInputsReady) return <EmptyState message="Lengkapi nominal, harga jual hari ini, dan tanggal transaksi obligasi yang dipegang sekarang." />;
  if (candidates.length === 0) {
    return (
      <EmptyState message={`Tidak ada obligasi ${oldBond.currency} lain dengan harga yang cocok di tabel indikasi harga yang diupload.`} />
    );
  }

  const ranked = sortCandidates(candidates, tab).slice(0, 10);

  return (
    <div>
      <SectionHeader index={1}>Rekomendasi Switching dari {oldBond.name}</SectionHeader>
      <Panel className="space-y-3 p-3">
        <p className="text-xs text-ink-muted">
          Dievaluasi {candidates.length} obligasi {oldBond.currency} lain yang punya harga di tabel indikasi harga hari
          ini. Top 10 ditampilkan per kriteria.
        </p>
        <div className="flex flex-wrap border border-border text-[13px]">
          {REC_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`flex-1 whitespace-nowrap px-3 py-2 font-semibold transition-colors ${
                tab === t.key ? "bg-accent text-accent-ink" : "bg-surface text-ink-muted hover:bg-surface-2"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <Table>
          <Thead>
            <tr>
              <th className="px-2.5 py-2 text-left">#</th>
              <th className="px-2.5 py-2 text-left">Kode</th>
              <th className="px-2.5 py-2 text-right">YTM</th>
              <th className="px-2.5 py-2 text-right">Kupon/Th</th>
              <th className="px-2.5 py-2 text-right">BEP</th>
              <th className="px-2.5 py-2 text-right">Duration</th>
              <th className="px-2.5 py-2 text-right">Selisih Nominal</th>
              <th className="px-2.5 py-2 text-right"></th>
            </tr>
          </Thead>
          <tbody>
            {ranked.map((c, i) => (
              <tr key={c.bond.id} className="border-b border-border last:border-0 hover:bg-surface-2">
                <td className="num px-2.5 py-1.5 text-ink-faint">{i + 1}</td>
                <td className="px-2.5 py-1.5 font-semibold text-ink">
                  {c.bond.name}
                  {c.bond.hasLockUp && (
                    <span className="ml-1.5">
                      <Pill tone="warning">LOCK-UP</Pill>
                    </span>
                  )}
                </td>
                <td className={`num px-2.5 py-1.5 text-right ${tab === "yield" ? "font-semibold text-accent-strong" : "text-ink"}`}>
                  {formatPercent(c.data.newBondSubscription.ytm, 2)}
                </td>
                <td className={`num px-2.5 py-1.5 text-right ${tab === "kupon" ? "font-semibold text-accent-strong" : "text-ink"}`}>
                  {formatCurrency(c.data.couponComparison.newAnnualCoupon, c.bond.currency)}
                </td>
                <td className={`num px-2.5 py-1.5 text-right ${tab === "bep" ? "font-semibold text-accent-strong" : "text-ink"}`}>
                  {c.data.bep.switchScenario.daysFromToday == null
                    ? "—"
                    : c.data.bep.switchScenario.daysFromToday === 0
                      ? "Sudah BEP"
                      : `${formatNumber(c.data.bep.switchScenario.daysFromToday / 365, 2)} th`}
                </td>
                <td className={`num px-2.5 py-1.5 text-right ${tab === "duration" ? "font-semibold text-accent-strong" : "text-ink"}`}>
                  {formatNumber(c.data.durationComparison.newDuration, 2)} th
                </td>
                <td
                  className={`num px-2.5 py-1.5 text-right ${
                    tab === "pricing" ? "font-semibold text-accent-strong" : (c.data.extraNominalVsRebuy ?? c.data.extraNominal) >= 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {(c.data.extraNominalVsRebuy ?? c.data.extraNominal) >= 0 ? "+" : ""}
                  {formatCurrency(c.data.extraNominalVsRebuy ?? c.data.extraNominal, c.bond.currency)}
                </td>
                <td className="px-2.5 py-1.5 text-right">
                  <SecondaryButton type="button" onClick={() => onPick(c)} className="px-2 py-1 text-xs">
                    Lihat Detail
                  </SecondaryButton>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

const FASTER_LABEL: Record<SwitchingResult["bep"]["faster"], string> = {
  switch: "Switching lebih cepat balik modal",
  stay: "Tetap hold lebih cepat balik modal",
  equal: "Sama cepatnya",
  neither: "Keduanya tidak balik modal sampai jatuh tempo",
  "already-broke-even": "Sudah untung / balik modal hari ini",
};

const FASTER_TONE: Record<SwitchingResult["bep"]["faster"], Tone> = {
  switch: "positive",
  "already-broke-even": "positive",
  stay: "warning",
  equal: "neutral",
  neither: "neutral",
};

function ResultView({ oldBond, newBond, data }: { oldBond: BondDTO; newBond: BondDTO; data: SwitchingResult }) {
  const hasRebuyBasis = data.oldNominalRebuyEquivalent != null && data.extraNominalVsRebuy != null;
  const pricingBaselineNominal = data.oldNominalRebuyEquivalent ?? data.oldNominal;
  const pricingSelisih = data.extraNominalVsRebuy ?? data.extraNominal;
  const pricingFavorable = pricingSelisih > 0;
  const newBuyPriceUsed = (data.newBondSubscription.principal / data.newNominal) * 100;
  const oldBuyPriceUsed =
    data.costPerUnitOldToday != null && data.accruedPerUnitOldToday != null ? (data.costPerUnitOldToday - data.accruedPerUnitOldToday) * 100 : null;

  return (
    <div className="space-y-6">
      <ProductTransitionCard oldBond={oldBond} newBond={newBond} />

      <RecommendationPanel oldBond={oldBond} newBond={newBond} data={data} />

      <div>
        <SectionPanel title="Sudah Selesai — Posisi Hari Ini" index={2}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={`Accrued Interest ${oldBond.name} (Jual)`} value={formatCurrency(data.redemption.sell!.accruedInterest, oldBond.currency)} />
            <Stat label="Dana Hasil Jual (Principal + Accrued)" value={formatCurrency(data.proceeds, oldBond.currency)} />
            <Stat label="Kupon Diterima Selama Holding" value={formatCurrency(data.periodicCouponsReceived, oldBond.currency)} />
          </div>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Untung/Rugi Secara Pricing (Switching)" index={3}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label={hasRebuyBasis ? `Nominal ${oldBond.name} (Beli Kembali Hari Ini)` : `Nominal ${oldBond.name} (Lama)`}
              value={formatCurrency(pricingBaselineNominal, oldBond.currency)}
            />
            <Stat label={`Nominal ${newBond.name} (Baru)`} value={formatCurrency(data.newNominal, newBond.currency)} />
            <Stat
              label="Selisih Nominal"
              value={`${pricingFavorable ? "+" : ""}${formatCurrency(pricingSelisih, newBond.currency)}`}
              tone={pricingFavorable ? "positive" : "negative"}
            />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {hasRebuyBasis ? (
              <>
                Dibandingkan &quot;apple-to-apple&quot;: dana hasil jual {oldBond.name} hari ini ({formatCurrency(data.proceeds, oldBond.currency)}
                ) dikonversi ke nominal masing-masing obligasi pada harga hari ini —{" "}
                {pricingFavorable
                  ? `switching ke ${newBond.name} menguntungkan secara harga, dana yang sama membeli nominal ${newBond.name} lebih besar dibanding kalau dibelikan kembali ke ${oldBond.name}.`
                  : `switching ke ${newBond.name} merugikan secara harga, dana yang sama hanya membeli nominal ${newBond.name} lebih kecil dibanding kalau dibelikan kembali ke ${oldBond.name}.`}
              </>
            ) : (
              <>
                Isi &quot;Harga Beli Kembali Hari Ini&quot; pada obligasi lama supaya perbandingan ini apple-to-apple (dikonversi
                dari dana hasil jual yang sama) — saat ini masih dibandingkan terhadap nominal historis saat beli pertama, yang
                bisa jadi dari harga yang jauh berbeda dari hari ini.
              </>
            )}
          </p>
          <div className="num mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-ink-faint">
            <p>Detail perhitungan nominal baru ({newBond.name}):</p>
            <p>
              Cost/unit {newBond.name} = (Harga {formatNumber(newBuyPriceUsed, 3)} ÷ 100) + Accrued/unit{" "}
              {formatNumber(data.accruedPerUnitNew, 6)} = {formatNumber(data.costPerUnitNew, 6)}
            </p>
            <p>
              Nominal Baru = Dana Hasil Jual ÷ Cost/unit = {formatCurrency(data.proceeds, oldBond.currency)} ÷{" "}
              {formatNumber(data.costPerUnitNew, 6)} = {formatCurrency(data.newNominal, newBond.currency)}
            </p>
            {hasRebuyBasis && oldBuyPriceUsed != null && (
              <>
                <p className="pt-1">Detail perhitungan nominal beli-kembali ({oldBond.name}):</p>
                <p>
                  Cost/unit {oldBond.name} = (Harga {formatNumber(oldBuyPriceUsed, 3)} ÷ 100) + Accrued/unit{" "}
                  {formatNumber(data.accruedPerUnitOldToday!, 6)} = {formatNumber(data.costPerUnitOldToday!, 6)}
                </p>
                <p>
                  Nominal Beli-Kembali = Dana Hasil Jual ÷ Cost/unit = {formatCurrency(data.proceeds, oldBond.currency)} ÷{" "}
                  {formatNumber(data.costPerUnitOldToday!, 6)} = {formatCurrency(data.oldNominalRebuyEquivalent!, oldBond.currency)}
                </p>
              </>
            )}
            <p className="pt-1">
              (Referensi: nominal {oldBond.name} saat beli pertama dulu = {formatCurrency(data.oldNominal, oldBond.currency)} —
              dipakai di bagian Kupon &amp; Modal Awal, bukan di perbandingan pricing ini.)
            </p>
          </div>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Posisi Terhadap Modal Awal" index={4}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Modal Awal (saat beli pertama)" value={formatCurrency(data.originalCapital, oldBond.currency)} />
            <Stat label="Nilai Terealisasi Hari Ini" value={formatCurrency(data.totalValueRealizedToday, oldBond.currency)} />
            <Stat
              label={data.profitVsCapitalToday >= 0 ? "Sudah Untung" : "Masih Kurang (Shortfall)"}
              value={formatCurrency(Math.abs(data.profitVsCapitalToday), oldBond.currency)}
              tone={data.profitVsCapitalToday >= 0 ? "positive" : "negative"}
            />
          </div>
          <p className="num mt-3 border-t border-border pt-3 text-[11px] text-ink-faint">
            Nilai Terealisasi − Modal Awal = {formatCurrency(data.totalValueRealizedToday, oldBond.currency)} −{" "}
            {formatCurrency(data.originalCapital, oldBond.currency)} ={" "}
            {data.profitVsCapitalToday >= 0 ? "+" : ""}
            {formatCurrency(data.profitVsCapitalToday, oldBond.currency)}
          </p>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Durasi Balik Modal (BEP) — via Kupon + Pull-to-Par" index={5}>
          <VerdictBanner tone={FASTER_TONE[data.bep.faster]}>{FASTER_LABEL[data.bep.faster]}</VerdictBanner>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <BepCard title={`Jika Switching ke ${newBond.name}`} projection={data.bep.switchScenario} highlight={data.bep.faster === "switch"} />
            <BepCard title={`Jika Tetap Hold ${oldBond.name}`} projection={data.bep.stayScenario} highlight={data.bep.faster === "stay"} />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Proyeksi mengasumsikan harga tetap seperti hari ini (tidak memprediksi pergerakan harga ke depan), dihitung
            dari akumulasi kupon berjalan ditambah keuntungan pull-to-par saat jatuh tempo (redemption di 100).
          </p>
          <div className="num mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-ink-faint">
            <p>
              Shortfall = Modal Awal − Nilai Terealisasi Hari Ini ={" "}
              {formatCurrency(Math.max(0, data.originalCapital - data.totalValueRealizedToday), oldBond.currency)}
            </p>
            <p>
              Total potensi s/d jatuh tempo jika switching (akumulasi kupon + pull-to-par):{" "}
              {formatCurrency(data.bep.switchScenario.cumulativeAtMaturity, newBond.currency)}
            </p>
            <p>
              Total potensi s/d jatuh tempo jika tetap hold (akumulasi kupon + pull-to-par):{" "}
              {formatCurrency(data.bep.stayScenario.cumulativeAtMaturity, oldBond.currency)}
            </p>
          </div>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Perbandingan Kupon Tahunan" index={6}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label={`Kupon/Tahun ${oldBond.name} (Tetap Hold)`}
              value={formatCurrency(data.couponComparison.oldAnnualCoupon, oldBond.currency)}
              tone={data.couponComparison.sameCurrency && (data.couponComparison.difference ?? 0) <= 0 ? "accent" : "neutral"}
            />
            <Stat
              label={`Kupon/Tahun ${newBond.name} (Switching)`}
              value={formatCurrency(data.couponComparison.newAnnualCoupon, newBond.currency)}
              tone={data.couponComparison.sameCurrency && (data.couponComparison.difference ?? 0) > 0 ? "accent" : "neutral"}
            />
            {data.couponComparison.sameCurrency ? (
              <Stat
                label="Selisih Kupon Tahunan"
                value={`${data.couponComparison.difference! >= 0 ? "+" : ""}${formatCurrency(data.couponComparison.difference!, newBond.currency)}`}
                tone={data.couponComparison.difference! >= 0 ? "positive" : "negative"}
              />
            ) : (
              <div className="flex items-center border border-border bg-surface-2 p-3.5 text-xs text-ink-muted">
                Mata uang berbeda ({oldBond.currency} vs {newBond.currency}) — selisih nominal tidak dibandingkan langsung.
              </div>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {data.couponComparison.sameCurrency
              ? (data.couponComparison.difference ?? 0) > 0
                ? `Secara kupon, switching menguntungkan — ${newBond.name} memberi pendapatan kupon tahunan lebih besar (nominal barunya lebih besar dan/atau kuponnya lebih tinggi).`
                : (data.couponComparison.difference ?? 0) < 0
                  ? `Secara kupon, switching merugikan — tetap hold ${oldBond.name} memberi pendapatan kupon tahunan lebih besar.`
                  : "Pendapatan kupon tahunan kedua opsi sama besar."
              : "Bandingkan kedua angka kupon tahunan di atas sesuai kebutuhan mata uang Anda."}
          </p>
          <div className="num mt-3 space-y-1 border-t border-border pt-3 text-[11px] text-ink-faint">
            <p>
              {oldBond.name}: Nominal {formatCurrency(data.oldNominal, oldBond.currency)} × Kupon{" "}
              {formatPercent(oldBond.couponRate, 3)} = {formatCurrency(data.couponComparison.oldAnnualCoupon, oldBond.currency)}
            </p>
            <p>
              {newBond.name}: Nominal {formatCurrency(data.newNominal, newBond.currency)} × Kupon{" "}
              {formatPercent(newBond.couponRate, 3)} = {formatCurrency(data.couponComparison.newAnnualCoupon, newBond.currency)}
            </p>
          </div>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Perbandingan Duration" index={7}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label={`Duration ${oldBond.name} (Tetap Hold)`}
              value={`${formatNumber(data.durationComparison.oldDuration, 2)} tahun`}
              tone={data.durationComparison.shorter === "stay" ? "accent" : "neutral"}
              sub={`YTM dipakai ${formatPercent(data.redemption.sell!.ytm, 2)}`}
            />
            <Stat
              label={`Duration ${newBond.name} (Switching)`}
              value={`${formatNumber(data.durationComparison.newDuration, 2)} tahun`}
              tone={data.durationComparison.shorter === "switch" ? "accent" : "neutral"}
              sub={`YTM dipakai ${formatPercent(data.newBondSubscription.ytm, 2)}`}
            />
            <Stat
              label="Selisih Duration"
              value={`${data.durationComparison.difference >= 0 ? "+" : ""}${formatNumber(data.durationComparison.difference, 2)} tahun`}
            />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {data.durationComparison.shorter === "switch"
              ? `Duration ${newBond.name} lebih pendek — dana Anda rata-rata "tertanam" lebih singkat dan lebih sedikit terpapar risiko perubahan suku bunga dibanding tetap hold ${oldBond.name}.`
              : data.durationComparison.shorter === "stay"
                ? `Duration ${oldBond.name} lebih pendek — kalau tetap hold, dana Anda rata-rata "tertanam" lebih singkat dibanding switching ke ${newBond.name}.`
                : "Duration kedua obligasi praktis sama."}{" "}
            Macaulay Duration = rata-rata tertimbang waktu (tahun) sampai seluruh arus kas (kupon + pokok) diterima,
            didiskon pada YTM masing-masing obligasi.
          </p>
        </SectionPanel>
      </div>
    </div>
  );
}

type CriterionFavor = "switch" | "stay" | null;

interface Criterion {
  name: string;
  detail: string;
  favor: CriterionFavor;
}

const FAVOR_LABEL: Record<"switch" | "stay" | "neutral", string> = {
  switch: "SWITCH",
  stay: "HOLD",
  neutral: "NETRAL",
};

const FAVOR_TONE: Record<"switch" | "stay" | "neutral", Tone> = {
  switch: "positive",
  stay: "warning",
  neutral: "neutral",
};

/**
 * Simple multi-criteria "DSS"-style scorecard: each criterion independently
 * votes switch/hold/neutral from figures already computed elsewhere on this
 * page, then the overall call is just a majority vote across non-neutral
 * votes. This is a decision aid, not a single blended score — the criteria
 * can (and often do) point different directions, and that disagreement is
 * itself useful information for the user.
 */
function RecommendationPanel({ oldBond, newBond, data }: { oldBond: BondDTO; newBond: BondDTO; data: SwitchingResult }) {
  const oldYield = data.redemption.sell!.ytm;
  const newYield = data.newBondSubscription.ytm;
  const yieldDiff = newYield - oldYield;
  const pricingSelisih = data.extraNominalVsRebuy ?? data.extraNominal;

  const criteria: Criterion[] = [
    {
      name: "Yield (YTM)",
      detail: `${newBond.name} ${formatPercent(newYield, 2)} vs ${oldBond.name} ${formatPercent(oldYield, 2)} (yield jual hari ini) — selisih ${yieldDiff >= 0 ? "+" : ""}${formatPercent(yieldDiff, 2)}`,
      favor: Math.abs(yieldDiff) < 1e-6 ? null : yieldDiff > 0 ? "switch" : "stay",
    },
    {
      name: "Untung Pricing (Nominal)",
      detail: `Selisih nominal ${pricingSelisih >= 0 ? "+" : ""}${formatCurrency(pricingSelisih, newBond.currency)}${data.extraNominalVsRebuy == null ? " (vs nominal historis — isi harga beli-kembali obligasi lama untuk basis apple-to-apple)" : ""}`,
      favor: pricingSelisih === 0 ? null : pricingSelisih > 0 ? "switch" : "stay",
    },
    {
      name: "Kupon Tahunan",
      detail: data.couponComparison.sameCurrency
        ? `Selisih ${data.couponComparison.difference! >= 0 ? "+" : ""}${formatCurrency(data.couponComparison.difference!, newBond.currency)}`
        : "Mata uang berbeda — tidak dibandingkan langsung",
      favor:
        !data.couponComparison.sameCurrency || (data.couponComparison.difference ?? 0) === 0
          ? null
          : data.couponComparison.difference! > 0
            ? "switch"
            : "stay",
    },
    {
      name: "Kecepatan Balik Modal (BEP)",
      detail: FASTER_LABEL[data.bep.faster],
      favor:
        data.bep.faster === "switch" || data.bep.faster === "already-broke-even"
          ? "switch"
          : data.bep.faster === "stay"
            ? "stay"
            : null,
    },
    {
      name: "Risiko Suku Bunga (Duration)",
      detail: `${formatNumber(data.durationComparison.newDuration, 2)} tahun vs ${formatNumber(data.durationComparison.oldDuration, 2)} tahun — lebih pendek = lebih rendah risiko`,
      favor: data.durationComparison.shorter === "equal" ? null : data.durationComparison.shorter,
    },
  ];

  const switchCount = criteria.filter((c) => c.favor === "switch").length;
  const stayCount = criteria.filter((c) => c.favor === "stay").length;
  const overall: "switch" | "stay" | "tie" = switchCount > stayCount ? "switch" : stayCount > switchCount ? "stay" : "tie";
  const overallTone: Tone = overall === "switch" ? "positive" : overall === "stay" ? "warning" : "neutral";
  const overallLabel =
    overall === "switch"
      ? `Switch direkomendasikan — ${switchCount} dari ${criteria.length} kriteria mendukung pindah ke ${newBond.name}.`
      : overall === "stay"
        ? `Tetap hold direkomendasikan — ${stayCount} dari ${criteria.length} kriteria mendukung bertahan di ${oldBond.name}.`
        : `Seimbang — ${switchCount} kriteria mendukung switch, ${stayCount} mendukung hold. Pertimbangkan prioritas Anda (yield vs risiko vs likuiditas).`;

  return (
    <SectionPanel title="Rekomendasi Switching (Multi-Kriteria)" index={1}>
      <VerdictBanner tone={overallTone}>{overallLabel}</VerdictBanner>
      <div className="mt-3 divide-y divide-border border border-border">
        {criteria.map((c) => (
          <div key={c.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
            <div>
              <p className="text-xs font-semibold text-ink">{c.name}</p>
              <p className="num mt-0.5 text-[11px] text-ink-muted">{c.detail}</p>
            </div>
            <Pill tone={FAVOR_TONE[c.favor ?? "neutral"]}>{FAVOR_LABEL[c.favor ?? "neutral"]}</Pill>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] text-ink-faint">
        Skor ini adalah alat bantu keputusan (voting per kriteria), bukan angka tunggal — kriteria bisa saling
        bertentangan (mis. yield lebih tinggi tapi duration lebih panjang), dan itu sengaja ditampilkan apa adanya
        supaya Anda yang menimbang prioritasnya.
      </p>
    </SectionPanel>
  );
}

function BepCard({
  title,
  projection,
  highlight,
}: {
  title: string;
  projection: SwitchingResult["bep"]["switchScenario"];
  highlight: boolean;
}) {
  return (
    <div className={`border p-4 ${highlight ? "border-positive/30 bg-positive-soft" : "border-border bg-surface"}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
      {projection.daysFromToday == null ? (
        <p className="mt-1 text-sm text-ink-muted">Tidak balik modal sampai jatuh tempo.</p>
      ) : (
        <p className="num mt-1 text-lg font-semibold text-ink">
          {projection.daysFromToday === 0 ? "Sudah balik modal" : `${formatNumber(projection.daysFromToday / 365, 2)} tahun`}
          {projection.reachedDate && projection.daysFromToday > 0 && (
            <span className="ml-1 text-sm font-normal text-ink-muted">({formatDate(projection.reachedDate)})</span>
          )}
        </p>
      )}
    </div>
  );
}

function BondSummaryBox({ bond }: { bond: BondDTO }) {
  return (
    <div className="border border-border bg-surface-2 px-3 py-2.5 text-xs text-ink-muted">
      <p className="flex flex-wrap items-center gap-1.5 font-medium text-ink">
        {bond.name}
        {bond.hasLockUp && <Pill tone="warning">LOCK-UP</Pill>}
      </p>
      <p className="mt-1">
        {bond.currency} · kupon <span className="num">{formatPercent(bond.couponRate, 3)}</span> · {bond.couponFrequency}
      </p>
      <p className="mt-0.5">
        Terbit {formatDate(bond.issueDate)} · Jatuh tempo {formatDate(bond.maturityDate)}
      </p>
      {(bond.spRating || bond.moodysRating) && (
        <p className="mt-0.5">
          Rating: {[bond.spRating, bond.moodysRating].filter(Boolean).join(" / ")}
          {bond.isinCode ? ` · ${bond.isinCode}` : ""}
        </p>
      )}
    </div>
  );
}

/** Prominent "old product → new product" transition summary at the top of the result. */
function ProductTransitionCard({ oldBond, newBond }: { oldBond: BondDTO; newBond: BondDTO }) {
  return (
    <Panel className="p-4">
      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Detail Produk Switching</p>
      <div className="grid items-center gap-3 sm:grid-cols-[1fr_auto_1fr]">
        <ProductDetail label="Dari" bond={oldBond} />
        <span className="num hidden text-lg text-accent-strong sm:block">&rarr;</span>
        <span className="num text-lg text-accent-strong sm:hidden">&darr;</span>
        <ProductDetail label="Ke" bond={newBond} align="right" />
      </div>
    </Panel>
  );
}

function ProductDetail({ label, bond, align = "left" }: { label: string; bond: BondDTO; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-base font-semibold text-ink" style={{ justifyContent: align === "right" ? "flex-end" : "flex-start" }}>
        {bond.name}
        {bond.hasLockUp && <Pill tone="warning">LOCK-UP</Pill>}
      </p>
      <p className="num mt-1 text-xs text-ink-muted">
        {bond.currency} · {formatPercent(bond.couponRate, 3)} · {bond.couponFrequency}
      </p>
      <p className="text-xs text-ink-muted">
        Terbit {formatDate(bond.issueDate)} &middot; JT {formatDate(bond.maturityDate)}
      </p>
      {(bond.spRating || bond.moodysRating) && (
        <p className="text-xs text-ink-muted">Rating {[bond.spRating, bond.moodysRating].filter(Boolean).join(" / ")}</p>
      )}
    </div>
  );
}
