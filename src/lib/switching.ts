/**
 * Bond switching calculator — sells a currently-held bond today and rolls the
 * proceeds into a new bond, then evaluates: the pricing edge (extra face value
 * gained/lost from the price differential), whether the position is already
 * ahead of the original capital, and how long (via coupon income) it takes to
 * break even — compared against simply continuing to hold the original bond.
 *
 * Built entirely on top of the existing calcRedemption / calcSubscription /
 * generateCouponSchedule primitives in `finance.ts` — no new bond math, just
 * new composition.
 */
import {
  type BondInput,
  type Holiday,
  type CalcResult,
  type CouponRow,
  type RedemptionResult,
  type SubscriptionResult,
  calcRedemption,
  calcSubscription,
  generateCouponSchedule,
  findCouponBounds,
  accruedInterest,
  taxRateForCurrency,
  daysBetween,
  dateOnly,
  workday,
  holidaySet,
  macaulayDuration,
} from "@/lib/finance";

export interface SwitchingInput {
  oldBond: BondInput;
  originalNominal: number;
  originalBuyTradeDate: Date;
  originalBuySettlementDate: Date;
  originalBuyPrice: number;
  todayTradeDate: Date;
  oldBondSellSettlementDate: Date;
  oldBondSellPriceToday: number;
  newBond: BondInput;
  newBondBuyPriceToday: number;
}

export interface BepProjection {
  reachedDate: Date | null;
  daysFromToday: number | null;
  cumulativeAtMaturity: number;
}

export interface SwitchingResult {
  redemption: RedemptionResult;
  proceeds: number;
  periodicCouponsReceived: number;
  originalCapital: number;
  totalValueRealizedToday: number;
  profitVsCapitalToday: number;
  oldNominal: number;
  newNominal: number;
  extraNominal: number;
  /** Clean price/100 + accrued-per-unit of the new bond -- the per-unit cost used to size newNominal. */
  costPerUnitNew: number;
  accruedPerUnitNew: number;
  newBondSubscription: SubscriptionResult;
  bep: {
    shortfall: number;
    switchScenario: BepProjection;
    stayScenario: BepProjection;
    faster: "switch" | "stay" | "equal" | "neither" | "already-broke-even";
  };
  couponComparison: {
    /** Annual coupon income if staying, on the original nominal (old bond's own currency). */
    oldAnnualCoupon: number;
    /** Annual coupon income after switching, on the new nominal (new bond's own currency). */
    newAnnualCoupon: number;
    /** Only meaningful when both bonds share a currency -- null otherwise. */
    difference: number | null;
    sameCurrency: boolean;
  };
  durationComparison: {
    /** Macaulay duration in years, discounted at each bond's own current YTM. */
    oldDuration: number;
    newDuration: number;
    difference: number;
    shorter: "switch" | "stay" | "equal";
  };
}

function projectBep(startDate: Date, shortfall: number, schedule: CouponRow[], parGainAtMaturity: number): BepProjection {
  if (shortfall <= 0) {
    return { reachedDate: startDate, daysFromToday: 0, cumulativeAtMaturity: 0 };
  }
  let cumulative = 0;
  let reached: { date: Date; days: number } | null = null;
  for (let i = 0; i < schedule.length; i++) {
    const row = schedule[i];
    let amount = row.totalReceived;
    if (i === schedule.length - 1) amount += parGainAtMaturity;
    cumulative += amount;
    if (!reached && cumulative >= shortfall) {
      reached = { date: row.date, days: daysBetween(startDate, row.date) };
    }
  }
  const totalCumulative = schedule.reduce((s, r) => s + r.totalReceived, 0) + parGainAtMaturity;
  return {
    reachedDate: reached?.date ?? null,
    daysFromToday: reached?.days ?? null,
    cumulativeAtMaturity: totalCumulative,
  };
}

export function calcSwitching(input: SwitchingInput, holidays: Holiday[]): CalcResult<SwitchingResult> {
  const redemption = calcRedemption(
    input.oldBond,
    {
      nominal: input.originalNominal,
      buyTradeDate: input.originalBuyTradeDate,
      buySettlementDate: input.originalBuySettlementDate,
      buyPrice: input.originalBuyPrice,
      sellTradeDate: input.todayTradeDate,
      sellSettlementDate: input.oldBondSellSettlementDate,
      sellPrice: input.oldBondSellPriceToday,
    },
    holidays
  );
  if (!redemption.ok) return redemption;
  if (!redemption.data.sell) {
    return { ok: false, error: "Gagal menghitung sisi jual (redemption) obligasi lama." };
  }

  const proceeds = redemption.data.sell.totalAmount;
  const periodicCouponsReceived = redemption.data.totalCouponsReceived - (redemption.data.accruedAtSale ?? 0);
  const originalCapital = redemption.data.buy.totalAmount;
  const totalValueRealizedToday = proceeds + periodicCouponsReceived;
  const profitVsCapitalToday = totalValueRealizedToday - originalCapital;

  // How much new-bond face value the redemption proceeds can buy: proceeds must
  // cover both principal (nominal * price/100) and accrued interest on the new
  // bond, both of which scale linearly with nominal. The settlement date must be
  // derived exactly like calcSubscription does internally (T+2, holiday-aware),
  // so the sizing below stays consistent with newBondSubscription's own figures.
  const newBondIssue = dateOnly(input.newBond.issueDate);
  const newBondTradeDate = dateOnly(input.todayTradeDate);
  const newSettle =
    newBondTradeDate < newBondIssue
      ? newBondIssue
      : workday(newBondTradeDate, 2, holidaySet(holidays, input.newBond.currency));
  const newBounds = findCouponBounds(input.newBond, newSettle);
  const accruedPerUnitNew = accruedInterest(input.newBond, newBounds.prev, newSettle, newBounds.next, 1);
  const costPerUnitNew = input.newBondBuyPriceToday / 100 + accruedPerUnitNew;
  if (costPerUnitNew <= 0) {
    return { ok: false, error: "Harga beli obligasi baru tidak valid." };
  }
  const newNominal = proceeds / costPerUnitNew;

  const newBondSubscription = calcSubscription(
    input.newBond,
    { nominal: newNominal, price: input.newBondBuyPriceToday, tradeDate: input.todayTradeDate },
    holidays
  );
  if (!newBondSubscription.ok) return newBondSubscription;

  const oldNominal = input.originalNominal;
  const extraNominal = newNominal - oldNominal;

  const shortfall = Math.max(0, originalCapital - totalValueRealizedToday);

  const taxRateNew = taxRateForCurrency(input.newBond.currency);
  const switchSchedule = generateCouponSchedule(
    input.newBond,
    newBondSubscription.data.couponNext,
    input.newBond.maturityDate,
    newNominal,
    taxRateNew,
    0
  );
  const switchParGain = newNominal * (100 - input.newBondBuyPriceToday) / 100;
  const switchScenario = projectBep(newSettle, shortfall, switchSchedule, switchParGain);

  const oldSettle = dateOnly(input.oldBondSellSettlementDate);
  const oldBoundsToday = findCouponBounds(input.oldBond, oldSettle);
  const taxRateOld = taxRateForCurrency(input.oldBond.currency);
  const staySchedule = generateCouponSchedule(
    input.oldBond,
    oldBoundsToday.next,
    input.oldBond.maturityDate,
    oldNominal,
    taxRateOld,
    0
  );
  const stayParGain = (oldNominal * (100 - input.oldBondSellPriceToday)) / 100;
  const stayScenario = projectBep(oldSettle, shortfall, staySchedule, stayParGain);

  let faster: SwitchingResult["bep"]["faster"];
  if (shortfall <= 0) {
    faster = "already-broke-even";
  } else if (switchScenario.daysFromToday == null && stayScenario.daysFromToday == null) {
    faster = "neither";
  } else if (switchScenario.daysFromToday == null) {
    faster = "stay";
  } else if (stayScenario.daysFromToday == null) {
    faster = "switch";
  } else if (switchScenario.daysFromToday === stayScenario.daysFromToday) {
    faster = "equal";
  } else {
    faster = switchScenario.daysFromToday < stayScenario.daysFromToday ? "switch" : "stay";
  }

  const oldAnnualCoupon = oldNominal * input.oldBond.couponRate;
  const newAnnualCoupon = newNominal * input.newBond.couponRate;
  const sameCurrency = input.oldBond.currency === input.newBond.currency;
  const couponComparison = {
    oldAnnualCoupon,
    newAnnualCoupon,
    difference: sameCurrency ? newAnnualCoupon - oldAnnualCoupon : null,
    sameCurrency,
  };

  const oldDuration = macaulayDuration(input.oldBond, oldSettle, redemption.data.sell.ytm);
  const newDuration = macaulayDuration(input.newBond, newSettle, newBondSubscription.data.ytm);
  const durationDiff = newDuration - oldDuration;
  const durationComparison = {
    oldDuration,
    newDuration,
    difference: durationDiff,
    shorter: (Math.abs(durationDiff) < 1e-9 ? "equal" : durationDiff < 0 ? "switch" : "stay") as "switch" | "stay" | "equal",
  };

  return {
    ok: true,
    data: {
      redemption: redemption.data,
      proceeds,
      periodicCouponsReceived,
      originalCapital,
      totalValueRealizedToday,
      profitVsCapitalToday,
      oldNominal,
      newNominal,
      extraNominal,
      costPerUnitNew,
      accruedPerUnitNew,
      newBondSubscription: newBondSubscription.data,
      bep: { shortfall, switchScenario, stayScenario, faster },
      couponComparison,
      durationComparison,
    },
  };
}
