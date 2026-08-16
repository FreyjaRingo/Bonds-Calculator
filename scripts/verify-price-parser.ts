import { parseMaybankPriceIndicationText, isMaybankPriceIndicationText } from "../src/lib/priceQuoteParser";

const sampleText = `
BOND PRICE INDICATION 8/12/2026
PROD_CODE TYPE KUPON MATURITY DATE MBI BELI YIELD MBI BELI MBI JUAL YIELD MBI JUAL 1D
Benchmark IDR
FR0103 6.750% 15-Jul-35 95.55 7.44% 98.30 7.01% 0.3
FR0104 6.500% 15-Jul-30 96.75 7.47% 99.50 6.64% 0.5
Benchmark USD
INDON54N5.15 callable 5.150% 10-Sep-54 85.06 6.29% 89.03 5.96% -0.06
INDON31NNNN 5.030% 29-May-31 98.47 5.39% 102.24 4.50%
Benchmark PBS Series
PBS030 5.875% 15-Jul-28 96.75 7.73% 99.25 6.29%
Non Benchmark IDR *)harga non-bechmark harap hubungi treasury untuk ketersediaan barang
FR56 8.375% 15-Sep-26 98.85 21.11% 0.00 0.00% 0
FR0100 6.625% 15-Feb-34 95.25 7.46% 98.50 6.88% 0
Non Benchmark USD *)harga non-bechmark harap hubungi treasury untuk ketersediaan barang
INDON54 callable 5.100% 10-Feb-54 84.88 6.26% 88.81 5.93% -0.07
Retail IDR
SR024T5 5.900% 10-Mar-31 94.25 7.39% 97.00 6.67% 0
Klik disini  https://www.maybank.co.id/Business/deposit-and-investment/investasi/ori/ntbpprm
Disclaimer:
- Harga merupakan harga indikasi dan dapat berubah sewaktu-waktu.
`;

let failures = 0;
function assertEq(label: string, actual: unknown, expected: unknown) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: actual=${JSON.stringify(actual)} expected=${JSON.stringify(expected)}`);
  if (!pass) failures++;
}

assertEq("isMaybankPriceIndicationText", isMaybankPriceIndicationText(sampleText), true);

const { asOfDate, rows } = parseMaybankPriceIndicationText(sampleText);
assertEq("asOfDate", asOfDate, "8/12/2026");
assertEq("row count", rows.length, 9);

const fr0103 = rows.find((r) => r.productCode === "FR0103")!;
assertEq("FR0103 mbiBeli", fr0103.mbiBeli, 95.55);
assertEq("FR0103 mbiJual", fr0103.mbiJual, 98.3);
assertEq("FR0103 isBenchmark", fr0103.isBenchmark, true);
assertEq("FR0103 section", fr0103.section, "Benchmark IDR");

const callableIndon54N = rows.find((r) => r.productCode === "INDON54N5.15")!;
assertEq("INDON54N5.15 type", callableIndon54N.type, "callable");
assertEq("INDON54N5.15 oneDay", callableIndon54N.oneDay, -0.06);

const missingOneDay = rows.find((r) => r.productCode === "INDON31NNNN")!;
assertEq("INDON31NNNN parses despite missing 1D", missingOneDay.mbiJual, 102.24);
assertEq("INDON31NNNN oneDay is null", missingOneDay.oneDay, null);

const pbs030 = rows.find((r) => r.productCode === "PBS030")!;
assertEq("PBS030 section", pbs030.section, "Benchmark PBS Series");
assertEq("PBS030 isBenchmark", pbs030.isBenchmark, true);

const fr0100 = rows.find((r) => r.productCode === "FR0100")!;
assertEq("FR0100 section (non-benchmark)", fr0100.isBenchmark, false);

const indon54 = rows.find((r) => r.productCode === "INDON54")!;
assertEq("INDON54 (non-benchmark, callable) mbiJual", indon54.mbiJual, 88.81);

console.log(`\n${failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
