"use client";

import { useEffect, useMemo, useState } from "react";
import { BondCombobox } from "@/components/BondCombobox";
import type { BondDTO } from "@/lib/types";
import { bondDtoToInput } from "@/lib/types";
import { calcSubscription, type Holiday, type SubscriptionResult } from "@/lib/finance";
import { formatCurrency, formatDate, formatNumber, formatPercent, toDateInputValue } from "@/lib/format";
import { Field, TextInput, Panel, SectionPanel, Stat, EmptyState, ErrorState, Table, Thead } from "@/components/ui";

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
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">Kalkulator</p>
        <h1 className="text-xl font-semibold text-ink">Subscription</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Kalkulator beli indikatif — settlement date, accrued interest, total dana didebit, YTM, dan jadwal kupon.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Panel className="space-y-4 p-5">
          <Field label="Obligasi">
            <BondCombobox value={bond} onChange={setBond} />
          </Field>
          <Field label="Nominal">
            <TextInput type="number" min={0} value={nominal} onChange={(e) => setNominal(e.target.value)} />
          </Field>
          <Field label="Harga Indikatif (per 100)">
            <TextInput type="number" min={0} step="0.001" value={price} onChange={(e) => setPrice(e.target.value)} />
          </Field>
          <Field label="Tanggal Transaksi">
            <TextInput type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
          </Field>
          {bond && (
            <div className="rounded border border-border bg-surface-2 px-3 py-2.5 text-xs text-ink-muted">
              <p>
                {bond.currency} · kupon <span className="num">{formatPercent(bond.couponRate, 3)}</span> ·{" "}
                {bond.couponFrequency}
              </p>
              <p>
                Terbit {formatDate(bond.issueDate)} · Jatuh tempo {formatDate(bond.maturityDate)}
              </p>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          {!bond && <EmptyState message="Pilih obligasi terlebih dahulu untuk mulai menghitung." />}
          {bond && !result && <EmptyState message="Lengkapi nominal, harga, dan tanggal transaksi yang valid." />}
          {bond && result && !result.ok && <ErrorState message={result.error} />}
          {bond && result && result.ok && <ResultView bond={bond} data={result.data} nominal={Number(nominal)} />}
        </div>
      </div>
    </div>
  );
}

function ResultView({ bond, data, nominal }: { bond: BondDTO; data: SubscriptionResult; nominal: number }) {
  const principalReturned = nominal;
  const totalCouponReceived = data.totalCouponsForward;
  const totalFundsAtEnd = principalReturned + totalCouponReceived;
  const initialInvestment = data.totalAmount;
  const difference = totalFundsAtEnd - initialInvestment;
  const roiGross = initialInvestment !== 0 ? difference / initialInvestment : 0;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Settlement" value={formatDate(data.settlementDate)} />
        <Stat label="Sisa ke Jatuh Tempo" value={`${formatNumber(data.yearsToMaturity, 2)} th`} />
        <Stat label="Hari Kupon Berjalan" value={`${data.accruedDays} hari`} />
        <Stat label="Indicative YTM" value={formatPercent(data.ytm)} tone="accent" />
        <Stat label="Kupon Sebelum → Berikutnya" value={`${formatDate(data.couponPrev)} → ${formatDate(data.couponNext)}`} />
        <Stat label="Accrued Interest" value={formatCurrency(data.accruedInterest, bond.currency)} />
        <Stat label="Principal" value={formatCurrency(data.principal, bond.currency)} />
        <Stat label="Total Dana Didebit" value={formatCurrency(data.totalAmount, bond.currency)} tone="accent" />
      </div>

      <SectionPanel title="Summary Cash Flow">
        <Table>
          <tbody className="divide-y divide-border">
            <SummaryRow label="Pengembalian Pokok" value={formatCurrency(principalReturned, bond.currency)} />
            <SummaryRow label="Total Kupon Diterima / Gross" value={formatCurrency(totalCouponReceived, bond.currency)} />
            <SummaryRow label="Total Dana Diterima Pada Akhir Periode" value={formatCurrency(totalFundsAtEnd, bond.currency)} />
            <SummaryRow label="Investasi Awal" value={formatCurrency(initialInvestment, bond.currency)} />
            <SummaryRow label="Selisih" value={formatCurrency(difference, bond.currency)} emphasis />
            <SummaryRow label="ROI Gross" value={formatPercent(roiGross, 2)} emphasis />
          </tbody>
        </Table>
      </SectionPanel>

      <SectionPanel title="Jadwal Kupon (sampai jatuh tempo)">
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
            </tbody>
            <tfoot className="border-t border-border bg-surface-2 text-sm font-semibold">
              <tr>
                <td colSpan={5} className="px-4 py-2 text-right">
                  Total Kupon
                </td>
                <td className="num px-4 py-2 text-right">{formatCurrency(data.totalCouponsForward, bond.currency)}</td>
              </tr>
            </tfoot>
          </Table>
        </div>
      </SectionPanel>
    </div>
  );
}

function SummaryRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <tr className={emphasis ? "bg-surface-2" : undefined}>
      <td className={`px-4 py-2 text-ink-muted ${emphasis ? "font-semibold text-ink" : ""}`}>{label}</td>
      <td className={`num px-4 py-2 text-right ${emphasis ? "font-semibold text-ink" : "text-ink"}`}>{value}</td>
    </tr>
  );
}
