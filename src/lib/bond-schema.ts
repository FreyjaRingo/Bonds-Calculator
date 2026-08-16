import { z } from "zod";

export const bondSchema = z.object({
  name: z.string().trim().min(1, "Nama obligasi wajib diisi").toUpperCase(),
  refinitivTicker: z.string().trim().optional().nullable(),
  hasLockUp: z.boolean().default(false),
  issueDate: z.coerce.date(),
  maturityDate: z.coerce.date(),
  moodysOutlook: z.string().trim().optional().nullable(),
  moodysRating: z.string().trim().optional().nullable(),
  spOutlook: z.string().trim().optional().nullable(),
  spRating: z.string().trim().optional().nullable(),
  currency: z.enum(["IDR", "USD"]),
  couponRate: z.coerce.number().min(0).max(1, "Kupon harus berupa desimal, contoh 0.0515 untuk 5.15%"),
  couponFrequency: z.enum(["Annually", "Semiannually", "Quarterly", "Monthly"]),
  isinCode: z.string().trim().optional().nullable(),
  couponType: z.enum(["REGULAR", "LONG", "SHORT"]).default("REGULAR"),
  firstCouponDate: z.coerce.date().optional().nullable(),
}).refine((b) => b.maturityDate > b.issueDate, {
  message: "Tanggal jatuh tempo harus setelah tanggal penerbitan",
  path: ["maturityDate"],
}).refine((b) => b.couponType === "REGULAR" || !!b.firstCouponDate, {
  message: "Tipe kupon LONG/SHORT memerlukan tanggal kupon pertama",
  path: ["firstCouponDate"],
});

export type BondFormValues = z.infer<typeof bondSchema>;
