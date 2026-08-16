"use client";

import { useCallback, useEffect, useState } from "react";
import type { BondDTO } from "@/lib/types";
import { BondForm } from "@/components/BondForm";
import { formatDate, formatPercent } from "@/lib/format";

export default function BondsPage() {
  const [bonds, setBonds] = useState<BondDTO[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<BondDTO | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BondDTO | null>(null);

  const load = useCallback((q: string) => {
    setLoading(true);
    fetch(`/api/bonds?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((data: BondDTO[]) => setBonds(data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(query), 200);
    return () => clearTimeout(t);
  }, [query, load]);

  function openCreate() {
    setEditing(null);
    setShowForm(true);
  }
  function openEdit(bond: BondDTO) {
    setEditing(bond);
    setShowForm(true);
  }
  function closeForm() {
    setShowForm(false);
    setEditing(null);
  }
  function onSaved() {
    closeForm();
    load(query);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await fetch(`/api/bonds/${deleteTarget.id}`, { method: "DELETE" });
    setDeleteTarget(null);
    load(query);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Database Obligasi</h1>
          <p className="mt-1 text-sm text-slate-600">Data referensi obligasi yang dipakai kedua kalkulator.</p>
        </div>
        <button
          onClick={openCreate}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          + Tambah Obligasi
        </button>
      </div>

      <input
        type="text"
        placeholder="Cari nama obligasi atau ISIN..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full max-w-sm rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="max-h-[65vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 text-left">Nama</th>
                <th className="px-4 py-2 text-left">Mata Uang</th>
                <th className="px-4 py-2 text-right">Kupon</th>
                <th className="px-4 py-2 text-left">Frekuensi</th>
                <th className="px-4 py-2 text-left">Jatuh Tempo</th>
                <th className="px-4 py-2 text-left">Tipe</th>
                <th className="px-4 py-2 text-left">ISIN</th>
                <th className="px-4 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && bonds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-slate-400">
                    Tidak ada obligasi ditemukan.
                  </td>
                </tr>
              )}
              {!loading &&
                bonds.map((bond) => (
                  <tr key={bond.id}>
                    <td className="px-4 py-2 font-medium text-slate-900">
                      {bond.name}
                      {bond.hasLockUp && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                          LOCK-UP
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{bond.currency}</td>
                    <td className="px-4 py-2 text-right">{formatPercent(bond.couponRate, 3)}</td>
                    <td className="px-4 py-2">{bond.couponFrequency}</td>
                    <td className="px-4 py-2">{formatDate(bond.maturityDate)}</td>
                    <td className="px-4 py-2">{bond.couponType}</td>
                    <td className="px-4 py-2 text-slate-500">{bond.isinCode ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => openEdit(bond)} className="mr-3 text-slate-600 hover:text-slate-900">
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget(bond)} className="text-red-600 hover:text-red-800">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && <BondForm initial={editing} onClose={closeForm} onSaved={onSaved} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Hapus Obligasi</h3>
            <p className="mt-2 text-sm text-slate-600">
              Yakin ingin menghapus <span className="font-medium">{deleteTarget.name}</span>? Tindakan ini tidak dapat
              dibatalkan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={confirmDelete}
                className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
