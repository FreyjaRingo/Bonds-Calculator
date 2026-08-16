import { calcSwitching } from "../src/lib/switching";
import type { BondInput } from "../src/lib/finance";

let failures = 0;
function assert(label: string, cond: boolean, detail: string) {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${cond ? "" : `  (${detail})`}`);
  if (!cond) failures++;
}

const oldBond: BondInput = {
  name: "FR-OLD",
  currency: "IDR",
  couponRate: 0.06,
  couponFrequency: "Semiannually",
  issueDate: new Date(Date.UTC(2023, 0, 15)),
  maturityDate: new Date(Date.UTC(2033, 0, 15)),
  couponType: "REGULAR",
  firstCouponDate: null,
  hasLockUp: false,
};

const newBond: BondInput = {
  name: "FR-NEW",
  currency: "IDR",
  couponRate: 0.07,
  couponFrequency: "Semiannually",
  issueDate: new Date(Date.UTC(2024, 0, 15)),
  maturityDate: new Date(Date.UTC(2034, 0, 15)),
  couponType: "REGULAR",
  firstCouponDate: null,
  hasLockUp: false,
};

const result = calcSwitching(
  {
    oldBond,
    originalNominal: 100_000_000,
    originalBuyTradeDate: new Date(Date.UTC(2023, 0, 17)),
    originalBuySettlementDate: new Date(Date.UTC(2023, 0, 17)),
    originalBuyPrice: 100,
    todayTradeDate: new Date(Date.UTC(2026, 7, 14)),
    oldBondSellSettlementDate: new Date(Date.UTC(2026, 7, 14)),
    oldBondSellPriceToday: 88,
    newBond,
    newBondBuyPriceToday: 86,
  },
  []
);

if (!result.ok) {
  console.error("calcSwitching failed:", result.error);
  process.exit(1);
}

const d = result.data;
console.log({
  proceeds: d.proceeds,
  periodicCouponsReceived: d.periodicCouponsReceived,
  originalCapital: d.originalCapital,
  totalValueRealizedToday: d.totalValueRealizedToday,
  profitVsCapitalToday: d.profitVsCapitalToday,
  oldNominal: d.oldNominal,
  newNominal: d.newNominal,
  extraNominal: d.extraNominal,
  newBondTotalAmount: d.newBondSubscription.totalAmount,
  bepShortfall: d.bep.shortfall,
  switchDays: d.bep.switchScenario.daysFromToday,
  switchDate: d.bep.switchScenario.reachedDate,
  stayDays: d.bep.stayScenario.daysFromToday,
  stayDate: d.bep.stayScenario.reachedDate,
  faster: d.bep.faster,
});

assert("newNominal > oldNominal (cheaper new bond buys more face value)", d.newNominal > d.oldNominal, `${d.newNominal} vs ${d.oldNominal}`);
assert("extraNominal matches newNominal - oldNominal", Math.abs(d.extraNominal - (d.newNominal - d.oldNominal)) < 1e-6, "");
assert(
  "new bond subscription totalAmount ~= proceeds (self-consistent)",
  Math.abs(d.newBondSubscription.totalAmount - d.proceeds) < 1,
  `${d.newBondSubscription.totalAmount} vs ${d.proceeds}`
);
assert("shortfall is non-negative", d.bep.shortfall >= 0, String(d.bep.shortfall));
assert(
  "profitVsCapitalToday consistent with shortfall (shortfall = max(0,-profit))",
  Math.abs(d.bep.shortfall - Math.max(0, -d.profitVsCapitalToday)) < 1,
  `${d.bep.shortfall} vs ${-d.profitVsCapitalToday}`
);
assert(
  "faster is a recognized scenario label",
  ["switch", "stay", "equal", "neither", "already-broke-even"].includes(d.bep.faster),
  d.bep.faster
);
assert("scenario 1 already broke even (profit already positive)", d.bep.faster === "already-broke-even", d.bep.faster);

console.log("\n--- Scenario 2: bigger price drop, should produce a real BEP shortfall ---");
const result2 = calcSwitching(
  {
    oldBond,
    originalNominal: 100_000_000,
    originalBuyTradeDate: new Date(Date.UTC(2023, 0, 17)),
    originalBuySettlementDate: new Date(Date.UTC(2023, 0, 17)),
    originalBuyPrice: 100,
    todayTradeDate: new Date(Date.UTC(2026, 7, 14)),
    oldBondSellSettlementDate: new Date(Date.UTC(2026, 7, 14)),
    oldBondSellPriceToday: 70,
    newBond,
    newBondBuyPriceToday: 68,
  },
  []
);
if (!result2.ok) {
  console.error("calcSwitching (scenario 2) failed:", result2.error);
  process.exit(1);
}
const d2 = result2.data;
console.log({
  proceeds: d2.proceeds,
  originalCapital: d2.originalCapital,
  totalValueRealizedToday: d2.totalValueRealizedToday,
  bepShortfall: d2.bep.shortfall,
  switchDays: d2.bep.switchScenario.daysFromToday,
  switchDate: d2.bep.switchScenario.reachedDate,
  switchCumulativeAtMaturity: d2.bep.switchScenario.cumulativeAtMaturity,
  stayDays: d2.bep.stayScenario.daysFromToday,
  stayDate: d2.bep.stayScenario.reachedDate,
  stayCumulativeAtMaturity: d2.bep.stayScenario.cumulativeAtMaturity,
  faster: d2.bep.faster,
});
assert("scenario 2 has a real shortfall", d2.bep.shortfall > 0, String(d2.bep.shortfall));
if (d2.bep.switchScenario.daysFromToday != null && d2.bep.stayScenario.daysFromToday != null) {
  const expected =
    d2.bep.switchScenario.daysFromToday < d2.bep.stayScenario.daysFromToday
      ? "switch"
      : d2.bep.switchScenario.daysFromToday === d2.bep.stayScenario.daysFromToday
        ? "equal"
        : "stay";
  assert("faster label matches actual day comparison (scenario 2)", d2.bep.faster === expected, `${d2.bep.faster} vs expected ${expected}`);
}
assert(
  "new bond subscription totalAmount ~= proceeds (self-consistent, scenario 2)",
  Math.abs(d2.newBondSubscription.totalAmount - d2.proceeds) < 1,
  `${d2.newBondSubscription.totalAmount} vs ${d2.proceeds}`
);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
