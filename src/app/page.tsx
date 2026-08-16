import Link from "next/link";

const cards = [
  {
    href: "/subscription",
    title: "Kalkulator Subscription",
    description:
      "Hitung settlement date, accrued interest, total dana yang didebit, YTM indikatif, dan jadwal kupon untuk pembelian obligasi baru.",
  },
  {
    href: "/redemption",
    title: "Kalkulator Redemption",
    description:
      "Hitung gain/loss dari transaksi beli-jual obligasi (round-trip): accrued interest kedua sisi, kupon yang diterima, pajak, ROI, dan annualized yield.",
  },
  {
    href: "/switching",
    title: "Kalkulator Switching",
    description:
      "Upload tabel indikasi harga, lalu cek untung/rugi pindah dari satu obligasi ke obligasi lain: pricing, posisi terhadap modal awal, dan durasi balik modal (BEP) dibanding tetap hold.",
  },
  {
    href: "/bonds",
    title: "Database Obligasi",
    description: "Cari, tambah, dan kelola data referensi obligasi (kupon, jatuh tempo, rating, ISIN, dll).",
  },
];

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Bonds Calculator</h1>
        <p className="mt-2 max-w-2xl text-slate-600">
          Versi web dari kalkulator obligasi — subscription, redemption &amp; switching — dengan database obligasi
          bersama yang bisa diakses oleh seluruh tim.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <h2 className="font-semibold text-slate-900">{card.title}</h2>
            <p className="text-sm text-slate-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
