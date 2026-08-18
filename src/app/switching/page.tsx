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
import { Field, TextInput, PrimaryButton, SecondaryButton, Panel, SectionPanel, Stat, Pill, VerdictBanner, EmptyState, ErrorState, type Tone } from "@/components/ui";

export default function SwitchingPage() {
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
    newBondBuyPriceToday,
    holidays,
  ]);

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

      <div className="grid gap-6 lg:grid-cols-2">
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
          </div>
        </Panel>

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
      </div>

      <div>
        {(!oldBond || !newBond) && <EmptyState message="Pilih obligasi lama dan obligasi tujuan untuk mulai menghitung." />}
        {oldBond && newBond && !result && <EmptyState message="Lengkapi semua nominal, harga, dan tanggal yang valid." />}
        {oldBond && newBond && result && !result.ok && <ErrorState message={result.error} />}
        {oldBond && newBond && result && result.ok && (
          <ResultView oldBond={oldBond} newBond={newBond} data={result.data} />
        )}
      </div>
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
  const pricingFavorable = data.extraNominal > 0;

  return (
    <div className="space-y-6">
      <ProductTransitionCard oldBond={oldBond} newBond={newBond} />

      <div>
        <SectionPanel title="Sudah Selesai — Posisi Hari Ini" index={1}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={`Accrued Interest ${oldBond.name} (Jual)`} value={formatCurrency(data.redemption.sell!.accruedInterest, oldBond.currency)} />
            <Stat label="Dana Hasil Jual (Principal + Accrued)" value={formatCurrency(data.proceeds, oldBond.currency)} />
            <Stat label="Kupon Diterima Selama Holding" value={formatCurrency(data.periodicCouponsReceived, oldBond.currency)} />
          </div>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Untung/Rugi Secara Pricing (Switching)" index={2}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label={`Nominal ${oldBond.name} (Lama)`} value={formatCurrency(data.oldNominal, oldBond.currency)} />
            <Stat label={`Nominal ${newBond.name} (Baru)`} value={formatCurrency(data.newNominal, newBond.currency)} />
            <Stat
              label="Selisih Nominal"
              value={`${pricingFavorable ? "+" : ""}${formatCurrency(data.extraNominal, newBond.currency)}`}
              tone={pricingFavorable ? "positive" : "negative"}
            />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            {pricingFavorable
              ? `Secara harga, switching menguntungkan — dana hasil jual bisa membeli nominal ${newBond.name} lebih besar dari nominal ${oldBond.name} yang dijual.`
              : `Secara harga, switching merugikan — dana hasil jual hanya cukup membeli nominal ${newBond.name} lebih kecil dari nominal ${oldBond.name} yang dijual.`}
          </p>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Posisi Terhadap Modal Awal" index={3}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Modal Awal (saat beli pertama)" value={formatCurrency(data.originalCapital, oldBond.currency)} />
            <Stat label="Nilai Terealisasi Hari Ini" value={formatCurrency(data.totalValueRealizedToday, oldBond.currency)} />
            <Stat
              label={data.profitVsCapitalToday >= 0 ? "Sudah Untung" : "Masih Kurang (Shortfall)"}
              value={formatCurrency(Math.abs(data.profitVsCapitalToday), oldBond.currency)}
              tone={data.profitVsCapitalToday >= 0 ? "positive" : "negative"}
            />
          </div>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Durasi Balik Modal (BEP) — via Kupon + Pull-to-Par" index={4}>
          <VerdictBanner tone={FASTER_TONE[data.bep.faster]}>{FASTER_LABEL[data.bep.faster]}</VerdictBanner>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <BepCard title={`Jika Switching ke ${newBond.name}`} projection={data.bep.switchScenario} highlight={data.bep.faster === "switch"} />
            <BepCard title={`Jika Tetap Hold ${oldBond.name}`} projection={data.bep.stayScenario} highlight={data.bep.faster === "stay"} />
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Proyeksi mengasumsikan harga tetap seperti hari ini (tidak memprediksi pergerakan harga ke depan), dihitung
            dari akumulasi kupon berjalan ditambah keuntungan pull-to-par saat jatuh tempo (redemption di 100).
          </p>
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Perbandingan Kupon Tahunan" index={5}>
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
        </SectionPanel>
      </div>

      <div>
        <SectionPanel title="Perbandingan Duration" index={6}>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat
              label={`Duration ${oldBond.name} (Tetap Hold)`}
              value={`${formatNumber(data.durationComparison.oldDuration, 2)} tahun`}
              tone={data.durationComparison.shorter === "stay" ? "accent" : "neutral"}
            />
            <Stat
              label={`Duration ${newBond.name} (Switching)`}
              value={`${formatNumber(data.durationComparison.newDuration, 2)} tahun`}
              tone={data.durationComparison.shorter === "switch" ? "accent" : "neutral"}
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
