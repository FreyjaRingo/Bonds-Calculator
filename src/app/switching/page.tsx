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
        <h1 className="text-xl font-semibold text-slate-900">Kalkulator Switching</h1>
        <p className="mt-1 text-sm text-slate-600">
          Jual obligasi yang sedang dipegang hari ini, alihkan dananya ke obligasi lain — cek untung/rugi dari sisi
          harga, posisi terhadap modal awal, dan durasi balik modal (BEP) dibanding tetap hold.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Upload Tabel Indikasi Harga</h2>
            <p className="mt-0.5 text-xs text-slate-500">
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {uploading ? "Membaca PDF..." : "Upload PDF"}
            </button>
          </div>
        </div>
        {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}
        {priceSheet && (
          <p className="mt-3 text-sm text-emerald-700">
            Terbaca {priceSheet.rows.length} baris harga{priceSheet.asOfDate ? ` per ${priceSheet.asOfDate}` : ""}. Harga
            akan otomatis terisi saat Anda memilih obligasi di bawah (kalau kodenya cocok).
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Obligasi yang Dipegang Sekarang (Jual)</h2>
          <Field label="Obligasi">
            <BondCombobox value={oldBond} onChange={setOldBond} />
          </Field>
          <Field label="Nominal Awal">
            <input
              type="number"
              min={0}
              value={originalNominal}
              onChange={(e) => setOriginalNominal(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tgl Beli Awal">
              <input
                type="date"
                value={originalBuyTradeDate}
                onChange={(e) => {
                  setOriginalBuyTradeDate(e.target.value);
                  if (!originalBuySettlementDate) suggestSettlement(oldBond, e.target.value, setOriginalBuySettlementDate);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </Field>
            <Field label="Settlement Beli Awal">
              <input
                type="date"
                value={originalBuySettlementDate}
                onChange={(e) => setOriginalBuySettlementDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </Field>
          </div>
          <Field label="Harga Beli Awal (per 100)">
            <input
              type="number"
              min={0}
              step="0.001"
              value={originalBuyPrice}
              onChange={(e) => setOriginalBuyPrice(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>

          <div className="border-t border-slate-100 pt-3">
            <Field label="Tanggal Transaksi Switching (hari ini)">
              <input
                type="date"
                value={todayTradeDate}
                onChange={(e) => {
                  setTodayTradeDate(e.target.value);
                  suggestSettlement(oldBond, e.target.value, setOldBondSellSettlementDate);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </Field>
            <div className="mt-3">
              <Field label="Settlement Jual Hari Ini">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={oldBondSellSettlementDate}
                    onChange={(e) => setOldBondSellSettlementDate(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => suggestSettlement(oldBond, todayTradeDate, setOldBondSellSettlementDate)}
                    className="whitespace-nowrap rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
                  >
                    T+2
                  </button>
                </div>
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Harga Jual Hari Ini (MBI Beli, per 100)">
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  value={oldBondSellPriceToday}
                  onChange={(e) => setOldBondSellPriceToday(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
              </Field>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Obligasi Tujuan Switching (Beli)</h2>
          <Field label="Obligasi">
            <BondCombobox value={newBond} onChange={setNewBond} />
          </Field>
          <Field label="Harga Beli Hari Ini (MBI Jual, per 100)">
            <input
              type="number"
              min={0}
              step="0.001"
              value={newBondBuyPriceToday}
              onChange={(e) => setNewBondBuyPriceToday(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-500">
            Nominal obligasi baru dihitung otomatis dari dana hasil penjualan obligasi lama (principal + accrued
            interest) dibagi harga beli obligasi baru — bukan nominal yang sama.
          </p>
          {newBond && (
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p>
                {newBond.currency} · kupon {formatPercent(newBond.couponRate, 3)} · {newBond.couponFrequency}
              </p>
              <p>Jatuh tempo {formatDate(newBond.maturityDate)}</p>
            </div>
          )}
        </div>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
      {message}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

const FASTER_LABEL: Record<SwitchingResult["bep"]["faster"], string> = {
  switch: "Switching lebih cepat balik modal",
  stay: "Tetap hold lebih cepat balik modal",
  equal: "Sama cepatnya",
  neither: "Keduanya tidak balik modal sampai jatuh tempo",
  "already-broke-even": "Sudah untung / balik modal hari ini",
};

function ResultView({ oldBond, newBond, data }: { oldBond: BondDTO; newBond: BondDTO; data: SwitchingResult }) {
  const pricingFavorable = data.extraNominal > 0;
  const verdictColor =
    data.bep.faster === "switch" || data.bep.faster === "already-broke-even"
      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
      : data.bep.faster === "stay"
        ? "border-amber-300 bg-amber-50 text-amber-800"
        : "border-slate-300 bg-slate-50 text-slate-700";

  return (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">1. Sudah Selesai — Posisi Hari Ini</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={`Accrued Interest ${oldBond.name} (Jual)`} value={formatCurrency(data.redemption.sell!.accruedInterest, oldBond.currency)} />
          <Stat label="Dana Hasil Jual (Principal + Accrued)" value={formatCurrency(data.proceeds, oldBond.currency)} />
          <Stat label="Kupon Diterima Selama Holding" value={formatCurrency(data.periodicCouponsReceived, oldBond.currency)} />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">2. Untung/Rugi Secara Pricing (Switching)</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label={`Nominal ${oldBond.name} (Lama)`} value={formatCurrency(data.oldNominal, oldBond.currency)} />
          <Stat label={`Nominal ${newBond.name} (Baru)`} value={formatCurrency(data.newNominal, newBond.currency)} />
          <Stat
            label="Selisih Nominal"
            value={`${pricingFavorable ? "+" : ""}${formatCurrency(data.extraNominal, newBond.currency)}`}
            highlight={pricingFavorable}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {pricingFavorable
            ? `Secara harga, switching menguntungkan — dana hasil jual bisa membeli nominal ${newBond.name} lebih besar dari nominal ${oldBond.name} yang dijual.`
            : `Secara harga, switching merugikan — dana hasil jual hanya cukup membeli nominal ${newBond.name} lebih kecil dari nominal ${oldBond.name} yang dijual.`}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">3. Posisi Terhadap Modal Awal</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Modal Awal (saat beli pertama)" value={formatCurrency(data.originalCapital, oldBond.currency)} />
          <Stat label="Nilai Terealisasi Hari Ini" value={formatCurrency(data.totalValueRealizedToday, oldBond.currency)} />
          <Stat
            label={data.profitVsCapitalToday >= 0 ? "Sudah Untung" : "Masih Kurang (Shortfall)"}
            value={formatCurrency(Math.abs(data.profitVsCapitalToday), oldBond.currency)}
            highlight={data.profitVsCapitalToday >= 0}
          />
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">4. Durasi Balik Modal (BEP) — via Kupon + Pull-to-Par</h2>
        <div className={`mb-3 rounded-xl border p-4 text-sm font-semibold ${verdictColor}`}>{FASTER_LABEL[data.bep.faster]}</div>
        <div className="grid gap-3 sm:grid-cols-2">
          <BepCard
            title={`Jika Switching ke ${newBond.name}`}
            projection={data.bep.switchScenario}
            highlight={data.bep.faster === "switch"}
          />
          <BepCard title={`Jika Tetap Hold ${oldBond.name}`} projection={data.bep.stayScenario} highlight={data.bep.faster === "stay"} />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Proyeksi mengasumsikan harga tetap seperti hari ini (tidak memprediksi pergerakan harga ke depan), dihitung
          dari akumulasi kupon berjalan ditambah keuntungan pull-to-par saat jatuh tempo (redemption di 100).
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">5. Perbandingan Kupon Tahunan</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={`Kupon/Tahun ${oldBond.name} (Tetap Hold)`}
            value={formatCurrency(data.couponComparison.oldAnnualCoupon, oldBond.currency)}
            highlight={data.couponComparison.sameCurrency && (data.couponComparison.difference ?? 0) <= 0}
          />
          <Stat
            label={`Kupon/Tahun ${newBond.name} (Switching)`}
            value={formatCurrency(data.couponComparison.newAnnualCoupon, newBond.currency)}
            highlight={data.couponComparison.sameCurrency && (data.couponComparison.difference ?? 0) > 0}
          />
          {data.couponComparison.sameCurrency ? (
            <Stat
              label="Selisih Kupon Tahunan"
              value={`${data.couponComparison.difference! >= 0 ? "+" : ""}${formatCurrency(data.couponComparison.difference!, newBond.currency)}`}
            />
          ) : (
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-500">
              Mata uang berbeda ({oldBond.currency} vs {newBond.currency}) — selisih nominal tidak dibandingkan langsung.
            </div>
          )}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {data.couponComparison.sameCurrency
            ? (data.couponComparison.difference ?? 0) > 0
              ? `Secara kupon, switching menguntungkan — ${newBond.name} memberi pendapatan kupon tahunan lebih besar (nominal barunya lebih besar dan/atau kuponnya lebih tinggi).`
              : (data.couponComparison.difference ?? 0) < 0
                ? `Secara kupon, switching merugikan — tetap hold ${oldBond.name} memberi pendapatan kupon tahunan lebih besar.`
                : "Pendapatan kupon tahunan kedua opsi sama besar."
            : "Bandingkan kedua angka kupon tahunan di atas sesuai kebutuhan mata uang Anda."}
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">6. Perbandingan Duration</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label={`Duration ${oldBond.name} (Tetap Hold)`}
            value={`${formatNumber(data.durationComparison.oldDuration, 2)} tahun`}
            highlight={data.durationComparison.shorter === "stay"}
          />
          <Stat
            label={`Duration ${newBond.name} (Switching)`}
            value={`${formatNumber(data.durationComparison.newDuration, 2)} tahun`}
            highlight={data.durationComparison.shorter === "switch"}
          />
          <Stat
            label="Selisih Duration"
            value={`${data.durationComparison.difference >= 0 ? "+" : ""}${formatNumber(data.durationComparison.difference, 2)} tahun`}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {data.durationComparison.shorter === "switch"
            ? `Duration ${newBond.name} lebih pendek — dana Anda rata-rata "tertanam" lebih singkat dan lebih sedikit terpapar risiko perubahan suku bunga dibanding tetap hold ${oldBond.name}.`
            : data.durationComparison.shorter === "stay"
              ? `Duration ${oldBond.name} lebih pendek — kalau tetap hold, dana Anda rata-rata "tertanam" lebih singkat dibanding switching ke ${newBond.name}.`
              : "Duration kedua obligasi praktis sama."}{" "}
          Macaulay Duration = rata-rata tertimbang waktu (tahun) sampai seluruh arus kas (kupon + pokok) diterima,
          didiskon pada YTM masing-masing obligasi.
        </p>
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
    <div className={`rounded-xl border p-4 ${highlight ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      {projection.daysFromToday == null ? (
        <p className="mt-1 text-sm text-slate-600">Tidak balik modal sampai jatuh tempo.</p>
      ) : (
        <p className="mt-1 text-lg font-semibold text-slate-900">
          {projection.daysFromToday === 0 ? "Sudah balik modal" : `${formatNumber(projection.daysFromToday / 365, 2)} tahun`}
          {projection.reachedDate && projection.daysFromToday > 0 && (
            <span className="ml-1 text-sm font-normal text-slate-500">({formatDate(projection.reachedDate)})</span>
          )}
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${highlight ? "border-slate-300 bg-slate-900 text-white" : "border-slate-200 bg-white"}`}>
      <p className={`text-xs uppercase tracking-wide ${highlight ? "text-slate-300" : "text-slate-500"}`}>{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
