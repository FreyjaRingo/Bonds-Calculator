import Link from "next/link";
import { Panel } from "@/components/ui";

const tools = [
  {
    href: "/subscription",
    label: "01",
    title: "Subscription",
    description:
      "Settlement date, accrued interest, total dana didebit, indicative YTM, dan jadwal kupon untuk pembelian baru.",
  },
  {
    href: "/redemption",
    label: "02",
    title: "Redemption",
    description: "Gain/loss beli-jual (round-trip): accrued kedua sisi, kupon diterima, pajak, ROI, annualized yield.",
  },
  {
    href: "/switching",
    label: "03",
    title: "Switching",
    description: "Upload tabel indikasi harga, cek untung/rugi pindah obligasi: pricing, kupon, dan duration.",
  },
  {
    href: "/bonds",
    label: "04",
    title: "Database Obligasi",
    description: "Cari, tambah, dan kelola data referensi obligasi yang dipakai ketiga kalkulator di atas.",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <div className="border-b border-border pb-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">Maybank Treasury</p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">Bonds Calculator</h1>
        <p className="mt-2 max-w-xl text-sm text-ink-muted">
          Kalkulator obligasi — subscription, redemption, dan switching — dengan database obligasi bersama yang
          diakses seluruh tim.
        </p>
      </div>
      <div className="grid gap-px overflow-hidden border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href} className="group bg-surface p-5 transition-colors hover:bg-surface-2">
            <span className="num text-xs font-semibold text-accent-strong">{tool.label}</span>
            <h2 className="mt-2 font-semibold text-ink group-hover:text-accent-strong">{tool.title}</h2>
            <p className="mt-1.5 text-sm text-ink-muted">{tool.description}</p>
          </Link>
        ))}
      </div>
      <Panel className="px-5 py-4 text-xs text-ink-muted">
        Semua perhitungan diverifikasi terhadap file Excel sumber (formula & macro VBA asli). Data obligasi &amp;
        kalender hari libur bursa dikelola bersama lewat halaman Database Obligasi.
      </Panel>
    </div>
  );
}
