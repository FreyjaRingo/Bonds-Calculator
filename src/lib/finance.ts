/**
 * Bond finance calculation engine.
 *
 * This is a faithful TypeScript port of the Excel formulas + VBA macros
 * (`HitungBondIndikatifManual` for Subscription, `HitungBondManual` for
 * Redemption) from "GainandLoss Bonds Calculator - V12.xlsm". Dates are
 * treated as UTC midnight throughout to avoid timezone drift. All money
 * amounts are on a face value of `nominal`; prices are clean prices per 100.
 */

export type Currency = "IDR" | "USD";
export type CouponFrequency = "Annually" | "Semiannually" | "Quarterly" | "Monthly";
export type CouponType = "REGULAR" | "LONG" | "SHORT";
export type Basis = "US30360" | "ActualActual";

export interface BondInput {
  name: string;
  currency: Currency;
  couponRate: number; // decimal, e.g. 0.06625
  couponFrequency: CouponFrequency;
  issueDate: Date;
  maturityDate: Date;
  couponType: CouponType;
  firstCouponDate: Date | null;
  hasLockUp: boolean;
}

export interface Holiday {
  date: Date;
  market: "IDR" | "USD";
}

// ---------------------------------------------------------------------------
// Date helpers (all operate on UTC-midnight Date objects)
// ---------------------------------------------------------------------------

export function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((dateOnly(b).getTime() - dateOnly(a).getTime()) / 86400000);
}

export function addDays(d: Date, days: number): Date {
  return new Date(dateOnly(d).getTime() + days * 86400000);
}

/** Mirrors Excel EDATE / VBA DateAdd("m", ...): keeps day-of-month, clamped to end of target month. */
export function addMonths(d: Date, months: number): Date {
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const firstOfTarget = new Date(Date.UTC(y, m + months, 1));
  const lastDay = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(d.getUTCDate(), lastDay);
  return new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth(), day));
}

export function sameDate(a: Date, b: Date): boolean {
  return dateOnly(a).getTime() === dateOnly(b).getTime();
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

/** Excel DAYS360 / VBA Days360, US (NASD) method. */
export function days360(d1: Date, d2: Date): number {
  const a = dateOnly(d1);
  const b = dateOnly(d2);
  let day1 = a.getUTCDate();
  let day2 = b.getUTCDate();
  const y1 = a.getUTCFullYear();
  const m1 = a.getUTCMonth() + 1;
  const y2 = b.getUTCFullYear();
  const m2 = b.getUTCMonth() + 1;
  if (day1 === 31) day1 = 30;
  if (day2 === 31 && day1 === 30) day2 = 30;
  return (y2 - y1) * 360 + (m2 - m1) * 30 + (day2 - day1);
}

/** Excel YEARFRAC basis 1 (Actual/Actual), calendar-year-split approximation. */
export function yearFracActualActual(start: Date, end: Date): number {
  const s = dateOnly(start);
  const e = dateOnly(end);
  if (s.getTime() === e.getTime()) return 0;
  if (s > e) return -yearFracActualActual(e, s);
  let years = 0;
  let cursor = s;
  while (cursor < e) {
    const y = cursor.getUTCFullYear();
    const nextYearStart = new Date(Date.UTC(y + 1, 0, 1));
    const daysInThisYear = isLeapYear(y) ? 366 : 365;
    if (nextYearStart >= e) {
      years += daysBetween(cursor, e) / daysInThisYear;
      break;
    } else {
      years += daysBetween(cursor, nextYearStart) / daysInThisYear;
      cursor = nextYearStart;
    }
  }
  return years;
}

function isWeekend(d: Date): boolean {
  const wd = dateOnly(d).getUTCDay();
  return wd === 0 || wd === 6;
}

/** Excel WORKDAY: `numDays` business days forward, skipping weekends & holidays. */
export function workday(start: Date, numDays: number, holidays: Set<string>): Date {
  let d = dateOnly(start);
  let remaining = numDays;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (!isWeekend(d) && !holidays.has(dateKey(d))) {
      remaining--;
    }
  }
  return d;
}

export function dateKey(d: Date): string {
  return dateOnly(d).toISOString().slice(0, 10);
}

export function holidaySet(holidays: Holiday[], market: "IDR" | "USD"): Set<string> {
  return new Set(holidays.filter((h) => h.market === market).map((h) => dateKey(h.date)));
}

// ---------------------------------------------------------------------------
// Bond conventions
// ---------------------------------------------------------------------------

export function frequencyMonths(freq: CouponFrequency): number {
  switch (freq) {
    case "Annually":
      return 12;
    case "Semiannually":
      return 6;
    case "Quarterly":
      return 3;
    case "Monthly":
      return 1;
  }
}

export function frequencyNumber(freq: CouponFrequency): number {
  switch (freq) {
    case "Annually":
      return 1;
    case "Semiannually":
      return 2;
    case "Quarterly":
      return 4;
    case "Monthly":
      return 12;
  }
}

export function basisForCurrency(currency: Currency): Basis {
  return currency === "USD" ? "US30360" : "ActualActual";
}

export function taxRateForCurrency(currency: Currency): number {
  return currency === "IDR" ? 0.1 : 0;
}

function yearDenominator(basis: Basis): number {
  return basis === "US30360" ? 360 : 365;
}

function daysBasis(basis: Basis, d1: Date, d2: Date): number {
  return basis === "US30360" ? days360(d1, d2) : daysBetween(d1, d2);
}

function roundToMillionths(pct: number): number {
  return Math.round(pct * 1_000_000) / 1_000_000;
}

/** LONG/SHORT bonds anchor to an explicit first coupon date; REGULAR bonds don't. */
function explicitFirstCoupon(bond: BondInput): Date | null {
  return bond.couponType !== "REGULAR" && bond.firstCouponDate ? dateOnly(bond.firstCouponDate) : null;
}

/** The absolute first coupon date of the bond's life (used for lock-up & refund-tax checks). */
export function absoluteFirstCoupon(bond: BondInput): Date {
  const explicit = explicitFirstCoupon(bond);
  if (explicit) return explicit;
  const months = frequencyMonths(bond.couponFrequency);
  let d = dateOnly(bond.maturityDate);
  while (addMonths(d, -months) > dateOnly(bond.issueDate)) {
    d = addMonths(d, -months);
  }
  return d;
}

export interface CouponBounds {
  prev: Date;
  next: Date;
}

/** Finds the coupon period (prev, next) that brackets `settlement`. Mirrors the VBA back-walk loop. */
export function findCouponBounds(bond: BondInput, settlement: Date): CouponBounds {
  const months = frequencyMonths(bond.couponFrequency);
  const firstCoupon = explicitFirstCoupon(bond);
  const maturity = dateOnly(bond.maturityDate);
  const issue = dateOnly(bond.issueDate);
  const settle = dateOnly(settlement);

  let temp = maturity;
  let next = temp;
  while (temp > settle) {
    next = temp;
    if (firstCoupon && temp <= firstCoupon) break;
    temp = addMonths(temp, -months);
  }
  let prev = temp;

  const absFirst = absoluteFirstCoupon(bond);
  if (settle <= absFirst) {
    prev = issue;
  } else if (prev < issue) {
    prev = issue;
  }
  return { prev, next };
}

/** Accrued interest amount on `nominal` face value, from `prev` coupon date to `settlement`. */
export function accruedInterest(bond: BondInput, prev: Date, settlement: Date, next: Date, nominal: number): number {
  const basis = basisForCurrency(bond.currency);
  if (basis === "US30360") {
    const days = days360(prev, settlement);
    const pct = bond.couponRate * (days / 360);
    return roundToMillionths(pct) * nominal;
  }
  const freqNum = frequencyNumber(bond.couponFrequency);
  const days = daysBetween(prev, settlement);
  const periodDays = daysBetween(prev, next);
  if (periodDays <= 0) return 0;
  const pct = (bond.couponRate / freqNum) * (days / periodDays);
  return roundToMillionths(pct) * nominal;
}

// ---------------------------------------------------------------------------
// Coupon cash-flow schedule
// ---------------------------------------------------------------------------

export interface CouponRow {
  index: number;
  date: Date;
  grossCoupon: number;
  netCoupon: number;
  taxRefund: number;
  totalReceived: number;
}

/**
 * Generates coupon cash flows starting at `startCouponDate` (inclusive) through `endDate` (inclusive),
 * stepping by the bond's coupon period. Handles a LONG/SHORT stub first coupon. `firstRowRefund` is
 * added on top of the first row's net coupon (tax already withheld on buy-side accrued interest).
 */
export function generateCouponSchedule(
  bond: BondInput,
  startCouponDate: Date,
  endDate: Date,
  nominal: number,
  taxRate: number,
  firstRowRefund: number
): CouponRow[] {
  const months = frequencyMonths(bond.couponFrequency);
  const basis = basisForCurrency(bond.currency);
  const freqNum = frequencyNumber(bond.couponFrequency);
  const firstCoupon = explicitFirstCoupon(bond);
  const denom = yearDenominator(basis);
  const issue = dateOnly(bond.issueDate);
  const end = dateOnly(endDate);

  const rows: CouponRow[] = [];
  let temp = dateOnly(startCouponDate);
  let idx = 1;
  const maxRows = 986; // mirrors the sheet's F15:K1000 range (1000-15+1)

  while (temp <= end && idx <= maxRows) {
    let gross: number;
    if (firstCoupon && sameDate(temp, firstCoupon)) {
      const days = daysBasis(basis, issue, firstCoupon);
      gross = nominal * bond.couponRate * (days / denom);
    } else {
      gross = nominal * (bond.couponRate / freqNum);
    }
    const tax = gross * taxRate;
    const net = gross - tax;
    const refund = idx === 1 ? firstRowRefund : 0;
    rows.push({ index: idx, date: temp, grossCoupon: gross, netCoupon: net, taxRefund: refund, totalReceived: net + refund });
    temp = addMonths(temp, months);
    idx++;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Yield (YTM) solver — Newton-Raphson equivalent of Excel YIELD / RATE
// ---------------------------------------------------------------------------

/** Standard Excel RATE algorithm (Newton-Raphson) — used for Monthly-coupon bonds. */
function excelRate(nper: number, pmt: number, pv: number, fv: number, guess: number): number {
  let rate = guess;
  for (let i = 0; i < 100; i++) {
    if (Math.abs(rate) < 1e-10) rate = rate >= 0 ? 1e-10 : -1e-10;
    const onePlusR = 1 + rate;
    const powN = Math.pow(onePlusR, nper);
    const f = pv * powN + pmt * ((powN - 1) / rate) + fv;
    const df = nper * pv * Math.pow(onePlusR, nper - 1) + pmt * ((nper * Math.pow(onePlusR, nper - 1) * rate - (powN - 1)) / (rate * rate));
    if (df === 0) break;
    const next = rate - f / df;
    if (!Number.isFinite(next)) break;
    if (Math.abs(next - rate) < 1e-12) return next;
    rate = next;
  }
  return rate;
}

export type MonthlyYieldMode = "rate" | "forceQuarterly";

export interface BondYieldOptions {
  /**
   * How to compute YTM for Monthly-coupon bonds — the two source sheets disagree:
   * - "rate" (default): mirrors the Redemption sheet's B30/C30, which special-cases
   *   Monthly bonds via RATE(nper-in-months, ...)*12 against the bond's real monthly
   *   coupon schedule.
   * - "forceQuarterly": mirrors the Kalkulator sheet's B33, which always calls the
   *   native YIELD() with frequency forced to 4 for both Quarterly and Monthly bonds
   *   (Excel's YIELD only accepts 1/2/4) — Excel then builds its own synthetic
   *   quarterly coupon schedule (stepping back 3 months from maturity), ignoring the
   *   bond's real monthly payment dates entirely for this calculation only.
   */
  monthlyMode?: MonthlyYieldMode;
}

/**
 * Bond yield-to-maturity (annualized), equivalent to Excel's YIELD() for standard
 * (non-Monthly) bonds. `cleanPrice` and the redemption value are both per-100 face value.
 */
export function bondYield(
  bond: BondInput,
  settlement: Date,
  cleanPrice: number,
  redemption = 100,
  options: BondYieldOptions = {}
): number {
  const settle = dateOnly(settlement);
  const maturity = dateOnly(bond.maturityDate);
  const basis = basisForCurrency(bond.currency);
  const monthlyMode = options.monthlyMode ?? "rate";

  if (bond.couponFrequency === "Monthly" && monthlyMode === "rate") {
    const yearsToMaturity = basis === "US30360" ? days360(settle, maturity) / 360 : yearFracActualActual(settle, maturity);
    const nper = Math.ceil(yearsToMaturity * 12);
    const { prev, next } = findCouponBounds(bond, settle);
    const accruedPer100 = accruedInterest(bond, prev, settle, next, 100);
    const pmt = (100 * bond.couponRate) / 12;
    const pv = -(cleanPrice + accruedPer100);
    return excelRate(nper, pmt, pv, redemption, bond.couponRate / 12) * 12;
  }

  // freqNum/months drive the coupon schedule used for the yield equation itself. For
  // Monthly bonds in "forceQuarterly" mode this is deliberately 4/3 (synthetic
  // quarterly schedule), not the bond's real 12/1 (monthly) -- matching Excel's own
  // YIELD() behavior when frequency is forced to 4.
  const isForcedMonthly = bond.couponFrequency === "Monthly" && monthlyMode === "forceQuarterly";
  const freqNum = isForcedMonthly ? 4 : frequencyNumber(bond.couponFrequency);
  const months = isForcedMonthly ? 3 : frequencyMonths(bond.couponFrequency);

  // Coupon bounds (prev/next) around settlement, stepping by `months` back from
  // maturity -- same walk as findCouponBounds, but using the (possibly synthetic)
  // frequency above rather than the bond's own coupon-type/stub logic.
  let temp = maturity;
  let next = temp;
  while (temp > settle) {
    next = temp;
    temp = addMonths(temp, -months);
  }
  const prev = temp;

  const denomDays = daysBasis(basis, prev, next);
  const dscDays = daysBasis(basis, settle, next);
  const dscOverE = denomDays > 0 ? dscDays / denomDays : 0;
  const couponPer100 = (100 * bond.couponRate) / freqNum;
  const accruedPer100 = denomDays > 0 ? couponPer100 * ((denomDays - dscDays) / denomDays) : 0;

  // Build the list of coupon dates from `next` through maturity.
  const dates: Date[] = [];
  let cursor = next;
  while (cursor <= maturity) {
    dates.push(cursor);
    cursor = addMonths(cursor, months);
  }
  if (dates.length === 0 || !sameDate(dates[dates.length - 1], maturity)) {
    dates.push(maturity);
  }

  const cashflows = dates.map((d, i) => ({
    n: i + 1,
    amount: i === dates.length - 1 ? couponPer100 + redemption : couponPer100,
  }));

  // Excel's YIELD equation solves for clean price = PV(future cashflows) - accrued interest.
  function priceAt(y: number): number {
    return cashflows.reduce((sum, cf) => sum + cf.amount / Math.pow(1 + y / freqNum, cf.n - 1 + dscOverE), 0) - accruedPer100;
  }
  function derivativeAt(y: number): number {
    return cashflows.reduce((sum, cf) => {
      const exp = cf.n - 1 + dscOverE;
      return sum - (exp * cf.amount) / freqNum / Math.pow(1 + y / freqNum, exp + 1);
    }, 0);
  }

  let y = bond.couponRate || 0.05;
  for (let i = 0; i < 100; i++) {
    const f = priceAt(y) - cleanPrice;
    const df = derivativeAt(y);
    if (df === 0) break;
    const next2 = y - f / df;
    if (!Number.isFinite(next2)) break;
    if (Math.abs(next2 - y) < 1e-12) {
      y = next2;
      break;
    }
    y = next2;
  }
  return y;
}

// ---------------------------------------------------------------------------
// Subscription calculator (mirrors "Kalkulator" sheet / HitungBondIndikatifManual)
// ---------------------------------------------------------------------------

export interface SubscriptionInput {
  nominal: number;
  price: number; // clean price per 100
  tradeDate: Date;
}

export interface SubscriptionResult {
  settlementDate: Date;
  couponPrev: Date;
  couponNext: Date;
  yearsToMaturity: number;
  accruedDays: number;
  accruedInterest: number;
  principal: number;
  totalAmount: number;
  ytm: number;
  taxRate: number;
  couponSchedule: CouponRow[];
  totalCouponsForward: number;
}

export type CalcResult<T> = { ok: true; data: T } | { ok: false; error: string };

export function calcSubscription(bond: BondInput, input: SubscriptionInput, holidays: Holiday[]): CalcResult<SubscriptionResult> {
  const tradeDate = dateOnly(input.tradeDate);
  const issue = dateOnly(bond.issueDate);
  const maturity = dateOnly(bond.maturityDate);

  if (tradeDate >= maturity) {
    return { ok: false, error: "Obligasi sudah Jatuh Tempo." };
  }

  const holidaysForMarket = holidaySet(holidays, bond.currency);
  const settlementDate = tradeDate < issue ? issue : workday(tradeDate, 2, holidaysForMarket);

  if (settlementDate >= maturity) {
    return { ok: false, error: "Tanggal settlement sudah melewati Jatuh Tempo." };
  }

  const { prev, next } = findCouponBounds(bond, settlementDate);
  const basis = basisForCurrency(bond.currency);
  const accruedDays = daysBasis(basis, prev, settlementDate);
  const accrued = accruedInterest(bond, prev, settlementDate, next, input.nominal);
  const principal = input.nominal * (input.price / 100);
  const totalAmount = principal + accrued;
  const taxRate = taxRateForCurrency(bond.currency);
  const refundTax = accrued * taxRate;

  const couponSchedule = generateCouponSchedule(bond, next, maturity, input.nominal, taxRate, refundTax);
  const totalCouponsForward = couponSchedule.reduce((s, r) => s + r.totalReceived, 0);

  const ytm = bondYield(bond, settlementDate, input.price, 100, { monthlyMode: "forceQuarterly" });

  const yearsToMaturity = Math.round((daysBetween(settlementDate, maturity) / 365) * 100) / 100;

  return {
    ok: true,
    data: {
      settlementDate,
      couponPrev: prev,
      couponNext: next,
      yearsToMaturity,
      accruedDays,
      accruedInterest: accrued,
      principal,
      totalAmount,
      ytm,
      taxRate,
      couponSchedule,
      totalCouponsForward,
    },
  };
}

// ---------------------------------------------------------------------------
// Redemption calculator (mirrors "Redemption" sheet / HitungBondManual)
// ---------------------------------------------------------------------------

export interface RedemptionInput {
  nominal: number;
  buyTradeDate: Date;
  buySettlementDate: Date;
  buyPrice: number;
  sellTradeDate?: Date | null;
  sellSettlementDate?: Date | null;
  sellPrice?: number | null;
}

export interface RedemptionLeg {
  couponPrev: Date;
  couponNext: Date;
  accruedDays: number;
  accruedInterest: number;
  principal: number;
  totalAmount: number;
  ytm: number;
}

export interface RedemptionResult {
  buy: RedemptionLeg;
  sell?: RedemptionLeg;
  couponSchedule: CouponRow[];
  accruedAtSale?: number;
  totalCouponsReceived: number;
  principalDifference?: number;
  netProfitLoss?: number;
  roi?: number;
  holdingDays?: number;
  yearsHeld?: number;
  annualizedYield?: number;
  capitalGainTaxIndicator?: number;
  capitalGainTax?: number;
  taxRate: number;
}

export function calcRedemption(bond: BondInput, input: RedemptionInput, holidays: Holiday[]): CalcResult<RedemptionResult> {
  void holidays; // settlement dates are user-supplied in the Redemption sheet, not auto-derived
  const issue = dateOnly(bond.issueDate);
  const buySettle = dateOnly(input.buySettlementDate);
  const taxRate = taxRateForCurrency(bond.currency);
  const basis = basisForCurrency(bond.currency);
  const absFirst = absoluteFirstCoupon(bond);

  if (buySettle < issue) {
    return { ok: false, error: `Settlement tidak boleh sebelum tanggal terbit (${dateKey(issue)}).` };
  }

  const buyBounds = findCouponBounds(bond, buySettle);
  const buyAccruedDays = daysBasis(basis, buyBounds.prev, buySettle);
  const buyAccrued = accruedInterest(bond, buyBounds.prev, buySettle, buyBounds.next, input.nominal);
  const buyPrincipal = input.nominal * (input.buyPrice / 100);
  const buy: RedemptionLeg = {
    couponPrev: buyBounds.prev,
    couponNext: buyBounds.next,
    accruedDays: buyAccruedDays,
    accruedInterest: buyAccrued,
    principal: buyPrincipal,
    totalAmount: buyPrincipal + buyAccrued,
    ytm: bondYield(bond, buySettle, input.buyPrice),
  };

  const hasSell = !!(input.sellSettlementDate && input.sellPrice != null && input.sellTradeDate);

  if (!hasSell) {
    const refundTax = buySettle > absFirst ? buyAccrued * taxRate : 0;
    const couponSchedule = generateCouponSchedule(bond, buyBounds.next, dateOnly(bond.maturityDate), input.nominal, taxRate, refundTax);
    const totalCouponsReceived = couponSchedule.reduce((s, r) => s + r.totalReceived, 0);
    return { ok: true, data: { buy, couponSchedule, totalCouponsReceived, taxRate } };
  }

  const sellTradeDate = dateOnly(input.sellTradeDate!);
  const sellSettle = dateOnly(input.sellSettlementDate!);

  if (bond.hasLockUp && sellTradeDate < absFirst) {
    return {
      ok: false,
      error: `Obligasi dalam masa Lock-up. Tidak dapat ditransaksikan (JUAL) sebelum kupon pertama (${dateKey(absFirst)}).`,
    };
  }
  if (sellSettle <= buySettle) {
    return { ok: false, error: "Tanggal settlement jual harus setelah tanggal settlement beli." };
  }

  const sellBounds = findCouponBounds(bond, sellSettle);
  const sellAccruedDays = daysBasis(basis, sellBounds.prev, sellSettle);
  const sellAccrued = accruedInterest(bond, sellBounds.prev, sellSettle, sellBounds.next, input.nominal);
  const sellPrincipal = input.nominal * (input.sellPrice! / 100);
  const sell: RedemptionLeg = {
    couponPrev: sellBounds.prev,
    couponNext: sellBounds.next,
    accruedDays: sellAccruedDays,
    accruedInterest: sellAccrued,
    principal: sellPrincipal,
    totalAmount: sellPrincipal + sellAccrued,
    ytm: bondYield(bond, sellSettle, input.sellPrice!),
  };

  const refundTax = buySettle > absFirst ? buyAccrued * taxRate : 0;
  const couponSchedule = generateCouponSchedule(bond, buyBounds.next, sellSettle, input.nominal, taxRate, refundTax);
  const couponTotal = couponSchedule.reduce((s, r) => s + r.totalReceived, 0);
  const totalCouponsReceived = couponTotal + sellAccrued;

  const principalDifference = sellPrincipal - buyPrincipal;
  const netProfitLoss = principalDifference + totalCouponsReceived;
  const roi = netProfitLoss / buyPrincipal;
  const holdingDays = daysBetween(buySettle, sellSettle);
  const yearsHeld = basis === "US30360" ? days360(buySettle, sellSettle) / 360 : yearFracActualActual(buySettle, sellSettle);
  const annualizedYield = yearsHeld !== 0 ? roi / yearsHeld : 0;

  const capitalGainTaxIndicator = principalDifference + sellAccrued;
  const capitalGainTax = capitalGainTaxIndicator < 0 ? 0 : capitalGainTaxIndicator * taxRate;

  return {
    ok: true,
    data: {
      buy,
      sell,
      couponSchedule,
      accruedAtSale: sellAccrued,
      totalCouponsReceived,
      principalDifference,
      netProfitLoss,
      roi,
      holdingDays,
      yearsHeld,
      annualizedYield,
      capitalGainTaxIndicator,
      capitalGainTax,
      taxRate,
    },
  };
}
