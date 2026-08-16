import type { BondInput, Currency, CouponFrequency, CouponType } from "@/lib/finance";

/** Shape of a Bond record as it comes back from the API (dates as ISO strings). */
export interface BondDTO {
  id: string;
  name: string;
  refinitivTicker: string | null;
  hasLockUp: boolean;
  issueDate: string;
  maturityDate: string;
  moodysOutlook: string | null;
  moodysRating: string | null;
  spOutlook: string | null;
  spRating: string | null;
  currency: Currency;
  couponRate: number;
  couponFrequency: CouponFrequency;
  isinCode: string | null;
  couponType: CouponType;
  firstCouponDate: string | null;
}

export function bondDtoToInput(bond: BondDTO): BondInput {
  return {
    name: bond.name,
    currency: bond.currency,
    couponRate: bond.couponRate,
    couponFrequency: bond.couponFrequency,
    issueDate: new Date(bond.issueDate),
    maturityDate: new Date(bond.maturityDate),
    couponType: bond.couponType,
    firstCouponDate: bond.firstCouponDate ? new Date(bond.firstCouponDate) : null,
    hasLockUp: bond.hasLockUp,
  };
}
