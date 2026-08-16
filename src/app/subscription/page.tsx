"use client";

import { useEffect, useMemo, useState } from "react";
import { BondCombobox } from "@/components/BondCombobox";
import type { BondDTO } from "@/lib/types";
import { bondDtoToInput } from "@/lib/types";
import { calcSubscription, type Holiday, type SubscriptionResult } from "@/lib/finance";
import { formatCurrency, formatDate, formatNumber, formatPercent, toDateInputValue } from "@/lib/format";

export default function SubscriptionPage() {
  const [bond, setBond] = useState<BondDTO | null>(null);
  const [nominal, setNominal] = useState<string>("100000");
  const [price, setPrice] = useState<string>("100");
  const [tradeDate, setTradeDate] = useState<string>(toDateInputValue(new Date()));
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  useEffect(() => {
    if (!bond) return;
    fetch(`/api/holidays?market=${bond.currency}`)
      .then((r) => r.json())
      .then((data: { date: string; market: "IDR" | "USD" }[]) =>
        setHolidays(data.map((h) => ({ date: new Date(h.date), market: h.market })))
      )
      .catch(() => setHolidays([]));
  }, [bond]);

  const result = useMemo(() => {
    if (!bond) return null;
    const nominalNum = Number(nominal);
    const priceNum = Number(price);
    if (!Number.isFinite(nominalNum) || nominalNum <= 0) return null;
    if (!Number.isFinite(priceNum) || priceNum <= 0) return null;
    if (!tradeDate) return null;
    return calcSubscription(
      bondDtoToInput(bond),
      { nominal: nominalNum, price: priceNum, tradeDate: new Date(tradeDate) },
      holidays
    );
  }, [bond, nominal, price, tradeDate, holidays]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Kalkulator Subscription</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kalkulator beli indikatif — settlement date, accrued interest, total dana didebit, YTM, dan jadwal kupon.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <Field label="Obligasi">
            <BondCombobox value={bond} onChange={setBond} />
          </Field>
          <Field label="Nominal">
            <input
              type="number"
              min={0}
              value={nominal}
              onChange={(e) => setNominal(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <Field label="Harga Indikatif (per 100)">
            <input
              type="number"
              min={0}
              step="0.001"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <Field label="Tanggal Transaksi">
            <input
              type="date"
              value={tradeDate}
              onChange={(e) => setTradeDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
          </Field>
          {bond && (
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p>
                {bond.currency} · kupon {formatPercent(bond.couponRate, 3)} · {bond.couponFrequency}
              </p>
              <p>
                Terbit {formatDate(bond.issueDate)} · Jatuh tempo {formatDate(bond.maturityDate)}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!bond && (
            <EmptyState message="Pilih obligasi terlebih dahulu untuk mulai menghitung." />
          )}
          {bond && !result && (
            <EmptyState message="Lengkapi nominal, harga, dan tanggal transaksi yang valid." />
          )}
          {bond && result && !result.ok && <ErrorState message={result.error} />}
          {bond && result && result.ok && <ResultView bond={bond} data={result.data} />}
        </div>
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
    <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white text-sm text-slate-400">
      {message}
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>
  );
}

function ResultView({ bond, data }: { bond: BondDTO; data: SubscriptionResult }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Tanggal Settlement" value={formatDate(data.settlementDate)} />
        <Stat label="Sisa Waktu ke Jatuh Tempo" value={`${formatNumber(data.yearsToMaturity, 2)} tahun`} />
        <Stat label="Kupon Sebelumnya / Berikutnya" value={`${formatDate(data.couponPrev)} → ${formatDate(data.couponNext)}`} />
        <Stat label="Hari Kupon Berjalan" value={`${data.accruedDays} hari`} />
        <Stat label="Accrued Interest" value={formatCurrency(data.accruedInterest, bond.currency)} highlight />
        <Stat label="Principal" value={formatCurrency(data.principal, bond.currency)} />
        <Stat label="Total Dana Didebit" value={formatCurrency(data.totalAmount, bond.currency)} highlight />
        <Stat label="Indicative YTM" value={formatPercent(data.ytm)} highlight />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Jadwal Kupon (sampai jatuh tempo)</h2>
        </div>
        <div className="max-h-96 overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Tanggal</th>
                <th className="px-4 py-2 text-right">Kupon Gross</th>
                <th className="px-4 py-2 text-right">Kupon Net</th>
                <th className="px-4 py-2 text-right">Refund Pajak</th>
                <th className="px-4 py-2 text-right">Total Diterima</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.couponSchedule.map((row) => (
                <tr key={row.index}>
                  <td className="px-4 py-2 text-slate-500">{row.index}</td>
                  <td className="px-4 py-2">{formatDate(row.date)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(row.grossCoupon, bond.currency)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(row.netCoupon, bond.currency)}</td>
                  <td className="px-4 py-2 text-right">{formatCurrency(row.taxRefund, bond.currency)}</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(row.totalReceived, bond.currency)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right">
                  Total Kupon
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(data.totalCouponsForward, bond.currency)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
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
