"use client";

import { useEffect, useMemo, useState } from "react";
import { BondCombobox } from "@/components/BondCombobox";
import type { BondDTO } from "@/lib/types";
import { bondDtoToInput } from "@/lib/types";
import { calcRedemption, type Holiday, type RedemptionResult, workday, holidaySet } from "@/lib/finance";
import { formatCurrency, formatDate, formatNumber, formatPercent, toDateInputValue } from "@/lib/format";
import { Field, TextInput, SecondaryButton, Panel, SectionPanel, Stat, Pill, EmptyState, ErrorState, Table, Thead } from "@/components/ui";

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
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">Kalkulator</p>
        <h1 className="text-xl font-semibold text-ink">Redemption</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Kalkulator beli-jual (round-trip) — accrued interest kedua sisi, kupon yang diterima, gain/loss, ROI, dan
          annualized yield.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel className="space-y-5 p-5">
          <Field label="Obligasi">
            <BondCombobox value={bond} onChange={setBond} />
          </Field>
          <Field label="Nominal">
            <TextInput type="number" min={0} value={nominal} onChange={(e) => setNominal(e.target.value)} />
          </Field>

          <div className="space-y-3 border-t border-border pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Sisi Beli</h3>
            <Field label="Tanggal Transaksi Beli">
              <TextInput
                type="date"
                value={buyTradeDate}
                onChange={(e) => {
                  setBuyTradeDate(e.target.value);
                  if (!buySettlementDate) suggestSettlement(e.target.value, setBuySettlementDate);
                }}
              />
            </Field>
            <Field label="Tanggal Settlement Beli">
              <div className="flex gap-2">
                <TextInput type="date" value={buySettlementDate} onChange={(e) => setBuySettlementDate(e.target.value)} />
                <SecondaryButton
                  type="button"
                  onClick={() => suggestSettlement(buyTradeDate, setBuySettlementDate)}
                  className="whitespace-nowrap px-2.5 py-0 text-xs"
                >
                  T+2
                </SecondaryButton>
              </div>
            </Field>
            <Field label="Harga Beli (per 100)">
              <TextInput type="number" min={0} step="0.001" value={buyPrice} onChange={(e) => setBuyPrice(e.target.value)} />
            </Field>
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
              <input type="checkbox" checked={includeSell} onChange={(e) => setIncludeSell(e.target.checked)} />
              Sisi Jual (opsional)
            </label>
            {includeSell && (
              <>
                <Field label="Tanggal Transaksi Jual">
                  <TextInput
                    type="date"
                    value={sellTradeDate}
                    onChange={(e) => {
                      setSellTradeDate(e.target.value);
                      if (!sellSettlementDate) suggestSettlement(e.target.value, setSellSettlementDate);
                    }}
                  />
                </Field>
                <Field label="Tanggal Settlement Jual">
                  <div className="flex gap-2">
                    <TextInput type="date" value={sellSettlementDate} onChange={(e) => setSellSettlementDate(e.target.value)} />
                    <SecondaryButton
                      type="button"
                      onClick={() => suggestSettlement(sellTradeDate, setSellSettlementDate)}
                      className="whitespace-nowrap px-2.5 py-0 text-xs"
                    >
                      T+2
                    </SecondaryButton>
                  </div>
                </Field>
                <Field label="Harga Jual (per 100)">
                  <TextInput type="number" min={0} step="0.001" value={sellPrice} onChange={(e) => setSellPrice(e.target.value)} />
                </Field>
              </>
            )}
          </div>

          {bond && (
            <div className="border border-border bg-surface-2 px-3 py-2.5 text-xs text-ink-muted">
              <p className="flex flex-wrap items-center gap-1.5">
                {bond.currency} · kupon <span className="num">{formatPercent(bond.couponRate, 3)}</span> · {bond.couponFrequency}
                {bond.hasLockUp && <Pill tone="warning">LOCK-UP</Pill>}
              </p>
              <p className="mt-1">
                Terbit {formatDate(bond.issueDate)} · Jatuh tempo {formatDate(bond.maturityDate)}
              </p>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          {!bond && <EmptyState message="Pilih obligasi terlebih dahulu untuk mulai menghitung." />}
          {bond && !result && <EmptyState message="Lengkapi nominal, harga, dan tanggal beli yang valid." />}
          {bond && result && !result.ok && <ErrorState message={result.error} />}
          {bond && result && result.ok && <ResultView bond={bond} data={result.data} />}
        </div>
      </div>
    </div>
  );
}

function ResultView({ bond, data }: { bond: BondDTO; data: RedemptionResult }) {
  const hasSell = !!data.sell;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Accrued Interest (Beli)" value={formatCurrency(data.buy.accruedInterest, bond.currency)} />
        <Stat label="Total Dana Didebit (Beli)" value={formatCurrency(data.buy.totalAmount, bond.currency)} />
        {hasSell && (
          <>
            <Stat label="Accrued Interest (Jual)" value={formatCurrency(data.sell!.accruedInterest, bond.currency)} />
            <Stat label="Total Dana Diterima (Jual)" value={formatCurrency(data.sell!.totalAmount, bond.currency)} />
          </>
        )}
        <Stat label="Total Kupon Diterima" value={formatCurrency(data.totalCouponsReceived, bond.currency)} tone="accent" />
        {hasSell && (
          <>
            <Stat label="Selisih Principal (Jual − Beli)" value={formatCurrency(data.principalDifference!, bond.currency)} />
            <Stat
              label="Net Profit / Loss"
              value={formatCurrency(data.netProfitLoss!, bond.currency)}
              tone={data.netProfitLoss! >= 0 ? "positive" : "negative"}
            />
            <Stat label="ROI" value={formatPercent(data.roi!, 4)} tone={data.roi! >= 0 ? "positive" : "negative"} />
            <Stat label="Annualized Yield" value={formatPercent(data.annualizedYield!, 4)} tone="accent" />
            <Stat label="Holding Period" value={`${data.holdingDays} hari`} sub={`${formatNumber(data.yearsHeld!, 4)} tahun`} />
            <Stat label="Estimasi Pajak Capital Gain (info)" value={formatCurrency(data.capitalGainTax ?? 0, bond.currency)} />
          </>
        )}
      </div>

      <SectionPanel title="Kupon yang Diterima Selama Holding Period">
        <div className="-m-4 max-h-96 overflow-auto">
          <Table>
            <Thead>
              <tr>
                <th className="px-4 py-2 text-left">#</th>
                <th className="px-4 py-2 text-left">Tanggal</th>
                <th className="px-4 py-2 text-right">Kupon Gross</th>
                <th className="px-4 py-2 text-right">Kupon Net</th>
                <th className="px-4 py-2 text-right">Refund Pajak</th>
                <th className="px-4 py-2 text-right">Total Diterima</th>
              </tr>
            </Thead>
            <tbody className="divide-y divide-border">
              {data.couponSchedule.map((row) => (
                <tr key={row.index}>
                  <td className="num px-4 py-2 text-ink-muted">{row.index}</td>
                  <td className="px-4 py-2">{formatDate(row.date)}</td>
                  <td className="num px-4 py-2 text-right">{formatCurrency(row.grossCoupon, bond.currency)}</td>
                  <td className="num px-4 py-2 text-right">{formatCurrency(row.netCoupon, bond.currency)}</td>
                  <td className="num px-4 py-2 text-right">{formatCurrency(row.taxRefund, bond.currency)}</td>
                  <td className="num px-4 py-2 text-right font-semibold">{formatCurrency(row.totalReceived, bond.currency)}</td>
                </tr>
              ))}
              {hasSell && data.accruedAtSale != null && (
                <tr className="bg-accent-soft/60">
                  <td className="px-4 py-2 text-ink-muted">—</td>
                  <td className="px-4 py-2">Accrued interest saat jual</td>
                  <td className="px-4 py-2 text-right">—</td>
                  <td className="px-4 py-2 text-right">—</td>
                  <td className="px-4 py-2 text-right">—</td>
                  <td className="num px-4 py-2 text-right font-semibold">{formatCurrency(data.accruedAtSale, bond.currency)}</td>
                </tr>
              )}
            </tbody>
            <tfoot className="border-t border-border bg-surface-2 text-sm font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right">
                  Total Kupon Diterima
                </td>
                <td className="num px-4 py-2 text-right">{formatCurrency(data.totalCouponsReceived, bond.currency)}</td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </SectionPanel>
    </div>
  );
}
