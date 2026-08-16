import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import bondsData from "./seed-data/bonds.json";
import holidaysData from "./seed-data/holidays.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type SeedBond = {
  name: string;
  refinitivTicker: string | null;
  hasLockUp: boolean;
  issueDate: string;
  maturityDate: string;
  moodysOutlook: string | null;
  moodysRating: string | null;
  spOutlook: string | null;
  spRating: string | null;
  currency: "IDR" | "USD";
  couponRate: number;
  couponFrequency: "Annually" | "Semiannually" | "Quarterly" | "Monthly";
  isinCode: string | null;
  couponType: "REGULAR" | "LONG" | "SHORT";
  firstCouponDate: string | null;
};

type SeedHoliday = {
  date: string;
  market: "IDR" | "USD";
};

async function main() {
  const bonds = bondsData as SeedBond[];
  const holidays = holidaysData as SeedHoliday[];

  console.log(`Seeding ${bonds.length} bonds...`);
  for (const b of bonds) {
    await prisma.bond.upsert({
      where: { name: b.name },
      update: {
        refinitivTicker: b.refinitivTicker,
        hasLockUp: b.hasLockUp,
        issueDate: new Date(b.issueDate),
        maturityDate: new Date(b.maturityDate),
        moodysOutlook: b.moodysOutlook,
        moodysRating: b.moodysRating,
        spOutlook: b.spOutlook,
        spRating: b.spRating,
        currency: b.currency,
        couponRate: b.couponRate,
        couponFrequency: b.couponFrequency,
        isinCode: b.isinCode === "NULL" ? null : b.isinCode,
        couponType: b.couponType,
        firstCouponDate: b.firstCouponDate ? new Date(b.firstCouponDate) : null,
      },
      create: {
        name: b.name,
        refinitivTicker: b.refinitivTicker,
        hasLockUp: b.hasLockUp,
        issueDate: new Date(b.issueDate),
        maturityDate: new Date(b.maturityDate),
        moodysOutlook: b.moodysOutlook,
        moodysRating: b.moodysRating,
        spOutlook: b.spOutlook,
        spRating: b.spRating,
        currency: b.currency,
        couponRate: b.couponRate,
        couponFrequency: b.couponFrequency,
        isinCode: b.isinCode === "NULL" ? null : b.isinCode,
        couponType: b.couponType,
        firstCouponDate: b.firstCouponDate ? new Date(b.firstCouponDate) : null,
      },
    });
  }

  console.log(`Seeding ${holidays.length} holidays...`);
  for (const h of holidays) {
    await prisma.holiday.upsert({
      where: { date_market: { date: new Date(h.date), market: h.market } },
      update: {},
      create: { date: new Date(h.date), market: h.market },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
