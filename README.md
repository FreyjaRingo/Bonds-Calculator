# Bonds Calculator

Web app version of the Maybank bond Subscription & Redemption Excel calculator. Built with Next.js 16 (App
Router), Prisma 7 + PostgreSQL, and Tailwind CSS.

- **Subscription calculator** (`/subscription`) — indicative purchase calculator: settlement date (T+2, holiday-aware),
  accrued interest, total amount to debit, indicative YTM, and the forward coupon cash-flow schedule.
- **Redemption calculator** (`/redemption`) — buy+sell round-trip P/L: accrued interest on both legs, coupons received
  during the holding period, capital gain/loss, ROI, annualized yield, and lock-up validation.
- **Bond database** (`/bonds`) — shared, searchable database of bonds (coupon, maturity, rating, ISIN, lock-up, etc.)
  with add/edit/delete, seeded from the original Excel workbook's 182 usable bond records.
- **Switching calculator** (`/switching`) — sell a currently-held bond today and roll the proceeds into another bond:
  upload a "BOND PRICE INDICATION" PDF to auto-fill today's bid/ask prices, then see the pricing edge (extra/less
  face value from the price differential), whether the position is already ahead of the original capital, and how
  long it takes to break even via coupon income + pull-to-par — compared against simply continuing to hold the
  original bond.

All bond math lives in [`src/lib/finance.ts`](src/lib/finance.ts), a framework-agnostic port of the Excel formulas
and VBA macros (`HitungBondIndikatifManual`, `HitungBondManual`) from the source workbook, composed further for the
switching calculator in [`src/lib/switching.ts`](src/lib/switching.ts). PDF price-sheet parsing
([`src/lib/priceQuoteParser.ts`](src/lib/priceQuoteParser.ts)) is a TypeScript port of the Maybank-format parser in
`Bonds-Excel/pdf_parsers.py`. All three are verified with standalone scripts:

```bash
npm run verify:finance          # finance.ts against the workbook's own cached example values
npx tsx scripts/verify-price-parser.ts
npx tsx scripts/verify-switching.ts
```

## Local development

Requirements: Node.js 20.9+.

```bash
npm install          # installs deps; postinstall runs `prisma generate`
```

You need a Postgres database for local dev. The easiest option — Prisma's own local dev server (no Docker/install
required), already configured for this project:

```bash
npx prisma dev -d   # starts a local Postgres in the background, prints connection strings
```

Copy the `TCP` connection string it prints (or run `npx prisma dev ls` later) into `.env` as `DATABASE_URL`, e.g.:

```
DATABASE_URL="postgres://postgres:postgres@localhost:<port>/template1?sslmode=disable"
```

Then apply the schema and seed the bond/holiday data:

```bash
npx prisma migrate dev
npm run db:seed
```

Run the app:

```bash
npm run dev
```

Open http://localhost:3000.

## Production database

This app needs a real Postgres database reachable from the internet (not the local `prisma dev` server above) so
everyone's bond additions/edits are shared. We use **[Neon](https://neon.tech)** (free tier) — chosen over
Supabase (free projects auto-pause after 7 days idle and need a manual dashboard restore — bad for an
infrequently-used internal tool with non-technical users) and Prisma Postgres (newer, ~2-3s cold-query latency on
free tier). Neon's free compute also idles after inactivity, but it wakes itself automatically and transparently on
the next request (no manual action, and no expiry/deletion of the project itself).

A Neon project (`bonds-calculator`, region `ap-southeast-1`/Singapore) has already been provisioned, migrated, and
seeded with the 182 bonds + 28 holidays. Connection strings are in `.env.production.local` (gitignored, not
committed — keep this file safe, it contains the database password):

- `DATABASE_URL` (pooled, via PgBouncer) — use this one for the actual running app (Vercel env var below). Required
  for serverless: many short-lived connections need pooling.
- `DIRECT_URL` — only for one-off `prisma migrate` commands later (poolers don't support the locks migrations need).

**⚠️ Ownership note:** this Neon project is currently under a personal account. Before this project changes hands
(e.g. end of internship), transfer it to a Maybank-controlled account/org — see
[Neon's project transfer docs](https://neon.tech/docs/manage/orgs-project-transfer) — so access isn't lost.

If you ever need to re-provision or add more bonds/years of holiday data later:

```bash
# Re-apply schema changes
DATABASE_URL="<DIRECT_URL from .env.production.local>" npx prisma migrate deploy
# Re-seed (safe to re-run — upserts by name/date+market, won't duplicate)
DATABASE_URL="<DIRECT_URL from .env.production.local>" npm run db:seed
```

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the project in Vercel ([vercel.com/new](https://vercel.com/new)).
3. Add environment variable `DATABASE_URL` in the Vercel project settings, using the **pooled** connection string
   from `.env.production.local`.
4. Deploy. `npm run build` runs `prisma generate` automatically via the `postinstall` script.

After this, the app is reachable at a public Vercel URL and the bond database is shared across everyone who uses it.

## Notes & known limitations (carried over from the source workbook)

- The exchange holiday calendars (used for T+2 settlement calculation) were only populated for 2026 in the source
  Excel file — extend the `Holiday` table for future years as needed (`prisma/seed-data/holidays.json` + re-seed, or
  add rows directly).
- 22 of the original 204 bond rows in the Excel "Data" sheet had incomplete data (missing issue/maturity dates) and
  were skipped during the data import; they were never fully populated in the source file either.
- The Redemption sheet's own cached example in the workbook referenced an older/inconsistent vintage of one bond's
  terms than the current "Data" sheet — this is a data-drift issue in the source file, not in this port (see the
  comment in `scripts/verify-finance.ts` for details of how the port was verified around it).
