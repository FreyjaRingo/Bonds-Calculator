/**
 * Parser for Maybank "BOND PRICE INDICATION" PDF price sheets.
 * Port of the line/token based parser from Bonds-Excel/pdf_parsers.py
 * (parse_maybank_price_indication_pdf / parse_maybank_price_line).
 */

const COUPON_RE = /^-?\d+(?:\.\d+)?%$/;
const DATE_RE = /^\d{1,2}-[A-Za-z]{3}-\d{2,4}$/;

export interface PriceQuoteRow {
  productCode: string;
  type: string;
  couponText: string;
  maturityText: string;
  mbiBeli: number | null;
  yieldMbiBeli: number | null;
  mbiJual: number | null;
  yieldMbiJual: number | null;
  oneDay: number | null;
  section: string;
  isBenchmark: boolean;
}

export interface ParsedPriceSheet {
  asOfDate: string | null;
  rows: PriceQuoteRow[];
}

function toNumber(token: string): number | null {
  const cleaned = token.replace(/%/g, "").replace(/,/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned.toUpperCase() === "N/A") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function isMaybankPriceIndicationText(text: string): boolean {
  const sample = text.slice(0, 4000).toLowerCase();
  const hasPriceHeader = sample.includes("bond price indication");
  const hasTableHeader =
    sample.includes("prod_code") && sample.includes("mbi beli") && sample.includes("yield mbi jual");
  const hasMaybankHeader = sample.includes("maybank") && hasTableHeader;
  return (hasPriceHeader && hasTableHeader) || hasMaybankHeader;
}

function parseLine(line: string): Omit<PriceQuoteRow, "section" | "isBenchmark"> | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  // Minimum: product_code, coupon, maturity, mbi_beli, yield_beli, mbi_jual, yield_jual (trailing "1D" is optional).
  if (tokens.length < 7) return null;

  let couponIdx = -1;
  for (let i = 1; i < tokens.length; i++) {
    if (COUPON_RE.test(tokens[i])) {
      couponIdx = i;
      break;
    }
  }
  if (couponIdx === -1) return null;

  const maturityIdx = couponIdx + 1;
  if (maturityIdx >= tokens.length || !DATE_RE.test(tokens[maturityIdx])) return null;

  // mbi_beli, yield_mbi_beli, mbi_jual, yield_mbi_jual are mandatory; the trailing
  // "1D" change column is sometimes blank in the source PDF and simply absent.
  const valueStart = maturityIdx + 1;
  if (valueStart + 3 >= tokens.length) return null;

  return {
    productCode: tokens[0],
    type: tokens.slice(1, couponIdx).join(" "),
    couponText: tokens[couponIdx],
    maturityText: tokens[maturityIdx],
    mbiBeli: toNumber(tokens[valueStart]),
    yieldMbiBeli: toNumber(tokens[valueStart + 1]),
    mbiJual: toNumber(tokens[valueStart + 2]),
    yieldMbiJual: toNumber(tokens[valueStart + 3]),
    oneDay: tokens.length > valueStart + 4 ? toNumber(tokens[valueStart + 4]) : null,
  };
}

export function parseMaybankPriceIndicationText(text: string): ParsedPriceSheet {
  const dateMatch = text.match(/BOND PRICE INDICATION\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
  const asOfDate = dateMatch ? dateMatch[1] : null;

  const rows: PriceQuoteRow[] = [];
  let currentSection = "";

  for (const rawLine of text.split("\n")) {
    const line = rawLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const lowered = line.toLowerCase();
    if (lowered.startsWith("benchmark ") || lowered.startsWith("non benchmark ")) {
      currentSection = line;
      continue;
    }

    const parsed = parseLine(line);
    if (!parsed) continue;

    rows.push({
      ...parsed,
      section: currentSection,
      isBenchmark: currentSection.toLowerCase().startsWith("benchmark "),
    });
  }

  return { asOfDate, rows };
}
