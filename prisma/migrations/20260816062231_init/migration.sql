-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('IDR', 'USD');

-- CreateEnum
CREATE TYPE "CouponFrequency" AS ENUM ('Annually', 'Semiannually', 'Quarterly', 'Monthly');

-- CreateEnum
CREATE TYPE "CouponType" AS ENUM ('REGULAR', 'LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "RatingOutlook" AS ENUM ('Positive', 'Stable', 'Negative');

-- CreateEnum
CREATE TYPE "Market" AS ENUM ('IDR', 'USD');

-- CreateTable
CREATE TABLE "Bond" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "refinitivTicker" TEXT,
    "hasLockUp" BOOLEAN NOT NULL DEFAULT false,
    "issueDate" TIMESTAMP(3) NOT NULL,
    "maturityDate" TIMESTAMP(3) NOT NULL,
    "moodysOutlook" TEXT,
    "moodysRating" TEXT,
    "spOutlook" TEXT,
    "spRating" TEXT,
    "currency" "Currency" NOT NULL,
    "couponRate" DOUBLE PRECISION NOT NULL,
    "couponFrequency" "CouponFrequency" NOT NULL,
    "isinCode" TEXT,
    "couponType" "CouponType" NOT NULL DEFAULT 'REGULAR',
    "firstCouponDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bond_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "market" "Market" NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bond_name_key" ON "Bond"("name");

-- CreateIndex
CREATE INDEX "Bond_currency_idx" ON "Bond"("currency");

-- CreateIndex
CREATE INDEX "Holiday_market_idx" ON "Holiday"("market");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_market_key" ON "Holiday"("date", "market");
