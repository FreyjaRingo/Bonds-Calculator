/**
 * Analysis columns layered on top of the raw parsed price sheet, porting the
 * simulation math from Bonds-Excel/calculations.py (MDURATION, Rate Hike/Cut,
 * Price if Yield Hike/Cut) and the currency/bond-type classifiers from
 * bond_utils.py. The PDF only gives coupon rate, maturity, and quoted
 * price/yield -- not the bond's real payment frequency or day-count basis --
 * so, matching the reference tool exactly, duration/PV here always assumes a
 * semiannual, Actual/Actual schedule regardless of currency. This is a
 * simplification (documented, not a bug) and intentionally kept separate
 * from the Excel-verified subscription/redemption/switching math in
 * `finance.ts`, which uses each bond's real frequency and basis.
 */
import { addMonths, daysBetween, dateOnly } from "@/lib/finance";

const USD_PREFIXES = ["INDON", "INDOIS"];
const SYARIAH_PREFIXES = ["PBS", "SR", "ST", "INDOIS"];

export function classifyCurrency(productCode: string): "IDR" | "USD" {
  const code = productCode.trim().toUpperCase();
  return USD_PREFIXES.some((p) => code.startsWith(p)) ? "USD" : "IDR";
}

export function classifyBondType(productCode: string): "Syariah" | "Konvensional" {
  const code = productCode.trim().toUpperCase();
  return SYARIAH_PREFIXES.some((p) => code.startsWith(p)) ? "Syariah" : "Konvensional";
}

/** Macaulay + Modified duration for a synthetic semiannual, Actual/Actual bullet bond. */
export function calcDuration(
  couponRateDecimal: number,
  yieldRateDecimal: number,
  maturity: Date,
  settlement: Date
): { macaulay: number; modified: number } | null {
  const mat = dateOnly(maturity);
  const settle = dateOnly(settlement);
  if (mat <= settle) return null;

  const dates: Date[] = [];
  let cursor = mat;
  while (cursor > settle) {
    dates.unshift(cursor);
    cursor = addMonths(cursor, -6);
  }
  if (dates.length === 0) return null;
  const prevCoupon = cursor;

  const denomDays = daysBetween(prevCoupon, dates[0]);
  const dscDays = daysBetween(settle, dates[0]);
  const dscOverE = denomDays > 0 ? dscDays / denomDays : 0;

  const couponPer100 = (100 * couponRateDecimal) / 2;
  let weightedSum = 0;
  let totalPV = 0;
  dates.forEach((_, i) => {
    const amount = i === dates.length - 1 ? couponPer100 + 100 : couponPer100;
    const exp = i + dscOverE;
    const tYears = exp / 2;
    const pv = amount / Math.pow(1 + yieldRateDecimal / 2, exp);
    weightedSum += tYears * pv;
    totalPV += pv;
  });
  if (totalPV <= 0) return null;

  const macaulay = weightedSum / totalPV;
  const modified = macaulay / (1 + yieldRateDecimal / 2);
  return { macaulay, modified };
}

/** Rate Hike/Cut = -+ yield * (shockPct/100), rounded to 6dp (calculations.py::calculate_rate_impact). */
export function calcRateImpact(yieldRateDecimal: number, shockPct: number, isHike: boolean): number {
  const rate = yieldRateDecimal * (shockPct / 100);
  const result = isHike ? -rate : rate;
  return Math.round(result * 1e6) / 1e6;
}

/** Years from base date to maturity, calendar days / 365.25, rounded to 4dp. */
export function calcYearsToMaturity(maturity: Date, base: Date): number {
  const diff = daysBetween(dateOnly(base), dateOnly(maturity));
  return Math.round((diff / 365.25) * 1e4) / 1e4;
}

/**
 * Theoretical annual-pay price at a given yield: PV of an annuity (annual
 * coupon = coupon% * 100) plus redemption, using fractional years-to-maturity
 * directly as the period count (numpy_financial.pv's closed-form formula
 * supports non-integer nper). Matches calculations.py::calculate_price_pv.
 */
export function calcPriceFromYield(couponRateDecimal: number, rateDecimal: number, nperYears: number): number | null {
  if (nperYears <= 0) return null;
  const pmt = 100 * couponRateDecimal;
  let price: number;
  if (Math.abs(rateDecimal) < 1e-12) {
    price = pmt * nperYears + 100;
  } else {
    const discount = Math.pow(1 + rateDecimal, -nperYears);
    price = pmt * ((1 - discount) / rateDecimal) + 100 * discount;
  }
  return Math.round(price * 1e4) / 1e4;
}
