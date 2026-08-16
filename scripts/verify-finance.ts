import { calcSubscription, calcRedemption, type BondInput } from "../src/lib/finance";

function approxEqual(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol;
}

let failures = 0;
function check(label: string, actual: number, expected: number, tol: number) {
  const pass = approxEqual(actual, expected, tol);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: actual=${actual}  expected=${expected}  diff=${actual - expected}`);
  if (!pass) failures++;
}

const indon54: BondInput = {
  name: "INDON54",
  currency: "USD",
  couponRate: 0.051,
  couponFrequency: "Semiannually",
  issueDate: new Date(Date.UTC(2024, 0, 10)),
  maturityDate: new Date(Date.UTC(2054, 1, 10)),
  couponType: "LONG",
  firstCouponDate: new Date(Date.UTC(2024, 7, 10)),
  hasLockUp: false,
};

console.log("=== Subscription (Kalkulator sheet, INDON54) ===");
const sub = calcSubscription(
  indon54,
  { nominal: 100000, price: 99.9, tradeDate: new Date(Date.UTC(2026, 7, 10)) },
  []
);
if (!sub.ok) {
  console.error("Subscription calc failed:", sub.error);
  process.exit(1);
}
console.log("settlementDate:", sub.data.settlementDate.toISOString().slice(0, 10), "(expected 2026-08-12)");
check("accruedInterest (B27)", sub.data.accruedInterest, 28.3, 0.01);
check("totalAmount (B32)", sub.data.totalAmount, 99928.3, 0.01);
check("ytm (B33)", sub.data.ytm, 0.0510678472944701, 1e-4);

// NOTE: the Redemption sheet's cached example uses a different vintage of
// INDON54's terms (5.15% coupon, issue 2024-09-10, maturity 2054-09-10,
// regular semiannual coupons) than the current "Data" sheet (5.1% coupon,
// LONG stub, maturity 2054-02-10) -- the two sheets' sample data drifted
// out of sync in the source workbook. We reconstruct the bond terms implied
// by the Redemption sheet's own cells (B14/B15/B16/B17/B60) to verify the
// calculation logic on its own terms.
const indon54Redemption: BondInput = {
  name: "INDON54 (Redemption sheet vintage)",
  currency: "USD",
  couponRate: 0.0515,
  couponFrequency: "Semiannually",
  issueDate: new Date(Date.UTC(2024, 8, 10)),
  maturityDate: new Date(Date.UTC(2054, 8, 10)),
  couponType: "REGULAR",
  firstCouponDate: null,
  hasLockUp: false,
};

console.log("\n=== Redemption (Redemption sheet, INDON54) ===");
const red = calcRedemption(
  indon54Redemption,
  {
    nominal: 5_000_000_000,
    buyTradeDate: new Date(Date.UTC(2026, 6, 10)),
    buySettlementDate: new Date(Date.UTC(2026, 6, 14)),
    buyPrice: 100,
    sellTradeDate: new Date(Date.UTC(2027, 6, 14)),
    sellSettlementDate: new Date(Date.UTC(2028, 6, 13)),
    sellPrice: 100,
  },
  []
);
if (!red.ok) {
  console.error("Redemption calc failed:", red.error);
  process.exit(1);
}
check("buy accrued (B23)", red.data.buy.accruedInterest, 88_695_000, 1);
check("sell accrued (C23)", red.data.sell!.accruedInterest, 87_980_000, 1);
check("totalCouponsReceived (B32)", red.data.totalCouponsReceived, 602_980_000, 1);
check("netProfitLoss (E5)", red.data.netProfitLoss!, 602_980_000, 1);
check("roi (E7)", red.data.roi!, 0.120596, 1e-4);
check("holdingDays (T9)", red.data.holdingDays!, 730, 0);
check("yearsHeld (T10)", red.data.yearsHeld!, 1.9972222222222222, 1e-6);
check("annualizedYield (E9)", red.data.annualizedYield!, 0.060381863699582754, 1e-4);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
