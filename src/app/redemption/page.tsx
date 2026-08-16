"use client";

import { useEffect, useMemo, useState } from "react";
import { BondCombobox } from "@/components/BondCombobox";
import type { BondDTO } from "@/lib/types";
import { bondDtoToInput } from "@/lib/types";
import { calcRedemption, type Holiday, type RedemptionResult, workday, holidaySet } from "@/lib/finance";
import { formatCurrency, formatDate, formatNumber, formatPercent, toDateInputValue } from "@/lib/format";

export default function RedemptionPage() {
  const [bond, setBond] = useState<BondDTO | null>(null);
  const [nominal, setNominal] = useState<string>("1000000000");

  const [buyTradeDate, setBuyTradeDate] = useState<string>(toDateInputValue(new Date()));
  const [buySettlementDate, setBuySettlementDate] = useState<string>("");
  const [buyPrice, setBuyPrice] = useState<string>("100");

  const [includeSell, setIncludeSell] = useState(false);
  const [sellTradeDate, setSellTradeDate] = useState<string>("");
  const [sellSettlementDate, setSellSettlementDate] = useState<string>("");
  const [sellPrice, setSellPrice] = useState<string>("100");

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

  function suggestSettlement(tradeDate: string, setter: (v: string) => void) {
    if (!bond || !tradeDate) return;
    const settle = workday(new Date(tradeDate), 2, holidaySet(holidays, bond.currency));
    setter(toDateInputValue(settle));
  }

  const result = useMemo(() => {
    if (!bond) return null;
    const nominalNum = Number(nominal);
    const buyPriceNum = Number(buyPrice);
    if (!Number.isFinite(nominalNum) || nominalNum <= 0) return null;
    if (!Number.isFinite(buyPriceNum) || buyPriceNum <= 0) return null;
    if (!buyTradeDate || !buySettlementDate) return null;

    const sellPriceNum = Number(sellPrice);
    const sellReady = includeSell && sellTradeDate && sellSettlementDate && Number.isFinite(sellPriceNum) && sellPriceNum > 0;

    return calcRedemption(
      bondDtoToInput(bond),
      {
        nominal: nominalNum,
        buyTradeDate: new Date(buyTradeDate),
        buySettlementDate: new Date(buySettlementDate),
        buyPrice: buyPriceNum,
        sellTradeDate: sellReady ? new Date(sellTradeDate) : null,
        sellSettlementDate: sellReady ? new Date(sellSettlementDate) : null,
        sellPrice: sellReady ? sellPriceNum : null,
      },
      holidays
    );
  }, [bond, nominal, buyTradeDate, buySettlementDate, buyPrice, includeSell, sellTradeDate, sellSettlementDate, sellPrice, holidays]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Kalkulator Redemption</h1>
        <p className="mt-1 text-sm text-slate-600">
          Kalkulator beli-jual (round-trip) — accrued interest kedua sisi, kupon yang diterima, gain/loss, ROI, dan
          annualized yield.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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

          <div className="space-y-3 border-t border-slate-100 pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Sisi Beli</h3>
            <Field label="Tanggal Transaksi Beli">
              <input
                type="date"
                value={buyTradeDate}
                onChange={(e) => {
                  setBuyTradeDate(e.target.value);
                  if (!buySettlementDate) suggestSettlement(e.target.value, setBuySettlementDate);
                }}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </Field>
            <Field label="Tanggal Settlement Beli">
              <div className="flex gap-2">
                <input
                  type="date"
                  value={buySettlementDate}
                  onChange={(e) => setBuySettlementDate(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => suggestSettlement(buyTradeDate, setBuySettlementDate)}
                  className="whitespace-nowrap rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
                >
                  T+2
                </button>
              </div>
            </Field>
            <Field label="Harga Beli (per 100)">
              <input
                type="number"
                min={0}
                step="0.001"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              />
            </Field>
          </div>

          <div className="space-y-3 border-t border-slate-100 pt-3">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <input type="checkbox" checked={includeSell} onChange={(e) => setIncludeSell(e.target.checked)} />
              Sisi Jual (opsional)
            </label>
            {includeSell && (
              <>
                <Field label="Tanggal Transaksi Jual">
                  <input
                    type="date"
                    value={sellTradeDate}
                    onChange={(e) => {
                      setSellTradeDate(e.target.value);
                      if (!sellSettlementDate) suggestSettlement(e.target.value, setSellSettlementDate);
                    }}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </Field>
                <Field label="Tanggal Settlement Jual">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={sellSettlementDate}
                      onChange={(e) => setSellSettlementDate(e.target.value)}
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => suggestSettlement(sellTradeDate, setSellSettlementDate)}
                      className="whitespace-nowrap rounded-md border border-slate-300 px-2 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      T+2
                    </button>
                  </div>
                </Field>
                <Field label="Harga Jual (per 100)">
                  <input
                    type="number"
                    min={0}
                    step="0.001"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
                  />
                </Field>
              </>
            )}
          </div>

          {bond && (
            <div className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">
              <p>
                {bond.currency} · kupon {formatPercent(bond.couponRate, 3)} · {bond.couponFrequency}
                {bond.hasLockUp ? " · Lock-up" : ""}
              </p>
              <p>
                Terbit {formatDate(bond.issueDate)} · Jatuh tempo {formatDate(bond.maturityDate)}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          {!bond && <EmptyState message="Pilih obligasi terlebih dahulu untuk mulai menghitung." />}
          {bond && !result && <EmptyState message="Lengkapi nominal, harga, dan tanggal beli yang valid." />}
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
  return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{message}</div>;
}

function ResultView({ bond, data }: { bond: BondDTO; data: RedemptionResult }) {
  const hasSell = !!data.sell;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Stat label="Accrued Interest (Beli)" value={formatCurrency(data.buy.accruedInterest, bond.currency)} />
        <Stat label="Total Dana Didebit (Beli)" value={formatCurrency(data.buy.totalAmount, bond.currency)} />
        {hasSell && (
          <>
            <Stat label="Accrued Interest (Jual)" value={formatCurrency(data.sell!.accruedInterest, bond.currency)} />
            <Stat label="Total Dana Diterima (Jual)" value={formatCurrency(data.sell!.totalAmount, bond.currency)} />
          </>
        )}
        <Stat label="Total Kupon Diterima" value={formatCurrency(data.totalCouponsReceived, bond.currency)} highlight />
        {hasSell && (
          <>
            <Stat label="Selisih Principal (Jual − Beli)" value={formatCurrency(data.principalDifference!, bond.currency)} />
            <Stat label="Net Profit / Loss" value={formatCurrency(data.netProfitLoss!, bond.currency)} highlight />
            <Stat label="ROI" value={formatPercent(data.roi!, 4)} highlight />
            <Stat label="Annualized Yield" value={formatPercent(data.annualizedYield!, 4)} highlight />
            <Stat label="Holding Period" value={`${data.holdingDays} hari (${formatNumber(data.yearsHeld!, 4)} tahun)`} />
            <Stat
              label="Estimasi Pajak Capital Gain (info)"
              value={formatCurrency(data.capitalGainTax ?? 0, bond.currency)}
            />
          </>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">Kupon yang Diterima Selama Holding Period</h2>
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
              {hasSell && data.accruedAtSale != null && (
                <tr className="bg-amber-50">
                  <td className="px-4 py-2 text-slate-500">—</td>
                  <td className="px-4 py-2">Accrued interest saat jual</td>
                  <td className="px-4 py-2 text-right">—</td>
                  <td className="px-4 py-2 text-right">—</td>
                  <td className="px-4 py-2 text-right">—</td>
                  <td className="px-4 py-2 text-right font-medium">{formatCurrency(data.accruedAtSale, bond.currency)}</td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 text-sm font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right">
                  Total Kupon Diterima
                </td>
                <td className="px-4 py-2 text-right">{formatCurrency(data.totalCouponsReceived, bond.currency)}</td>
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
