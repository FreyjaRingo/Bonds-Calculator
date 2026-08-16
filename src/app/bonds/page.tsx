"use client";

import { useCallback, useEffect, useState } from "react";
import type { BondDTO } from "@/lib/types";
import { BondForm } from "@/components/BondForm";
import { formatDate, formatPercent } from "@/lib/format";
import { TextInput, PrimaryButton, SecondaryButton, Panel, Pill, Table, Thead } from "@/components/ui";

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
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">Data Bersama</p>
          <h1 className="text-xl font-semibold text-ink">Database Obligasi</h1>
          <p className="mt-1 text-sm text-ink-muted">Data referensi obligasi yang dipakai ketiga kalkulator.</p>
        </div>
        <PrimaryButton onClick={openCreate}>+ Tambah Obligasi</PrimaryButton>
      </div>

      <TextInput
        type="text"
        placeholder="Cari nama obligasi atau ISIN..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="max-w-sm"
      />

      <Panel className="overflow-hidden">
        <div className="max-h-[65vh] overflow-auto">
          <Table>
            <Thead>
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
            </Thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-ink-faint">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && bonds.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-ink-faint">
                    Tidak ada obligasi ditemukan.
                  </td>
                </tr>
              )}
              {!loading &&
                bonds.map((bond) => (
                  <tr key={bond.id}>
                    <td className="px-4 py-2 font-medium text-ink">
                      <span className="inline-flex items-center gap-2">
                        {bond.name}
                        {bond.hasLockUp && <Pill tone="warning">LOCK-UP</Pill>}
                      </span>
                    </td>
                    <td className="px-4 py-2">{bond.currency}</td>
                    <td className="num px-4 py-2 text-right">{formatPercent(bond.couponRate, 3)}</td>
                    <td className="px-4 py-2">{bond.couponFrequency}</td>
                    <td className="px-4 py-2">{formatDate(bond.maturityDate)}</td>
                    <td className="px-4 py-2">{bond.couponType}</td>
                    <td className="num px-4 py-2 text-ink-muted">{bond.isinCode ?? "—"}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => openEdit(bond)} className="mr-3 text-ink-muted hover:text-accent-strong">
                        Edit
                      </button>
                      <button onClick={() => setDeleteTarget(bond)} className="text-negative hover:text-negative/80">
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </Table>
        </div>
      </Panel>

      {showForm && <BondForm initial={editing} onClose={closeForm} onSaved={onSaved} />}

      {deleteTarget && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/70 p-4">
          <Panel className="w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-ink">Hapus Obligasi</h3>
            <p className="mt-2 text-sm text-ink-muted">
              Yakin ingin menghapus <span className="font-medium text-ink">{deleteTarget.name}</span>? Tindakan ini
              tidak dapat dibatalkan.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <SecondaryButton onClick={() => setDeleteTarget(null)}>Batal</SecondaryButton>
              <button
                onClick={confirmDelete}
                className="bg-negative px-4 py-2 text-sm font-medium text-white hover:bg-negative/85"
              >
                Hapus
              </button>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
