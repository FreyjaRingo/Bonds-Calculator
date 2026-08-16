"use client";

import { useState } from "react";
import type { BondDTO } from "@/lib/types";
import { toDateInputValue } from "@/lib/format";

interface BondFormProps {
  initial?: BondDTO | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  name: string;
  refinitivTicker: string;
  currency: "IDR" | "USD";
  couponRate: string; // percent, e.g. "5.15"
  couponFrequency: "Annually" | "Semiannually" | "Quarterly" | "Monthly";
  issueDate: string;
  maturityDate: string;
  isinCode: string;
  moodysRating: string;
  moodysOutlook: string;
  spRating: string;
  spOutlook: string;
  couponType: "REGULAR" | "LONG" | "SHORT";
  firstCouponDate: string;
  hasLockUp: boolean;
}

function toFormState(bond?: BondDTO | null): FormState {
  return {
    name: bond?.name ?? "",
    refinitivTicker: bond?.refinitivTicker ?? "",
    currency: bond?.currency ?? "IDR",
    couponRate: bond ? String(bond.couponRate * 100) : "",
    couponFrequency: bond?.couponFrequency ?? "Semiannually",
    issueDate: bond ? toDateInputValue(bond.issueDate) : "",
    maturityDate: bond ? toDateInputValue(bond.maturityDate) : "",
    isinCode: bond?.isinCode ?? "",
    moodysRating: bond?.moodysRating ?? "",
    moodysOutlook: bond?.moodysOutlook ?? "",
    spRating: bond?.spRating ?? "",
    spOutlook: bond?.spOutlook ?? "",
    couponType: bond?.couponType ?? "REGULAR",
    firstCouponDate: bond?.firstCouponDate ? toDateInputValue(bond.firstCouponDate) : "",
    hasLockUp: bond?.hasLockUp ?? false,
  };
}

export function BondForm({ initial, onClose, onSaved }: BondFormProps) {
  const [form, setForm] = useState<FormState>(toFormState(initial));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const isEdit = !!initial;
  const isStub = form.couponType !== "REGULAR";

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    const couponRateNum = Number(form.couponRate);
    const payload = {
      name: form.name,
      refinitivTicker: form.refinitivTicker || null,
      currency: form.currency,
      couponRate: Number.isFinite(couponRateNum) ? couponRateNum / 100 : NaN,
      couponFrequency: form.couponFrequency,
      issueDate: form.issueDate,
      maturityDate: form.maturityDate,
      isinCode: form.isinCode || null,
      moodysRating: form.moodysRating || null,
      moodysOutlook: form.moodysOutlook || null,
      spRating: form.spRating || null,
      spOutlook: form.spOutlook || null,
      couponType: form.couponType,
      firstCouponDate: isStub ? form.firstCouponDate || null : null,
      hasLockUp: isStub ? form.hasLockUp : false,
    };

    try {
      const res = await fetch(isEdit ? `/api/bonds/${initial!.id}` : "/api/bonds", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Gagal menyimpan obligasi.");
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      setError("Gagal menghubungi server.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{isEdit ? "Edit Obligasi" : "Tambah Obligasi Baru"}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <div className="grid grid-cols-2 gap-4">
            <TextField label="Nama Obligasi" value={form.name} onChange={(v) => update("name", v)} required />
            <TextField label="Refinitiv Ticker" value={form.refinitivTicker} onChange={(v) => update("refinitivTicker", v)} />
            <SelectField
              label="Mata Uang"
              value={form.currency}
              onChange={(v) => update("currency", v as FormState["currency"])}
              options={["IDR", "USD"]}
            />
            <TextField
              label="Kupon (%)"
              type="number"
              step="0.0001"
              value={form.couponRate}
              onChange={(v) => update("couponRate", v)}
              required
            />
            <SelectField
              label="Frekuensi Kupon"
              value={form.couponFrequency}
              onChange={(v) => update("couponFrequency", v as FormState["couponFrequency"])}
              options={["Annually", "Semiannually", "Quarterly", "Monthly"]}
            />
            <TextField label="ISIN Code" value={form.isinCode} onChange={(v) => update("isinCode", v)} />
            <TextField label="Tanggal Penerbitan" type="date" value={form.issueDate} onChange={(v) => update("issueDate", v)} required />
            <TextField label="Tanggal Jatuh Tempo" type="date" value={form.maturityDate} onChange={(v) => update("maturityDate", v)} required />
            <TextField label="Moody's Rating" value={form.moodysRating} onChange={(v) => update("moodysRating", v)} />
            <TextField label="Moody's Outlook" value={form.moodysOutlook} onChange={(v) => update("moodysOutlook", v)} />
            <TextField label="S&P Rating" value={form.spRating} onChange={(v) => update("spRating", v)} />
            <TextField label="S&P Outlook" value={form.spOutlook} onChange={(v) => update("spOutlook", v)} />
          </div>

          <div className="rounded-lg border border-slate-200 p-4">
            <SelectField
              label="Tipe Kupon Awal"
              value={form.couponType}
              onChange={(v) => update("couponType", v as FormState["couponType"])}
              options={["REGULAR", "LONG", "SHORT"]}
            />
            {isStub && (
              <div className="mt-3 space-y-3">
                <TextField
                  label="Tanggal Kupon Pertama"
                  type="date"
                  value={form.firstCouponDate}
                  onChange={(v) => update("firstCouponDate", v)}
                  required
                />
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" checked={form.hasLockUp} onChange={(e) => update("hasLockUp", e.target.checked)} />
                  Obligasi memiliki masa Lock-Up (tidak dapat dijual sebelum kupon pertama)
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  step,
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <input
        type={type}
        step={step}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}
