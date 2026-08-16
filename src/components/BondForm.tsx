"use client";

import { useState } from "react";
import type { BondDTO } from "@/lib/types";
import { toDateInputValue } from "@/lib/format";
import { Field, TextInput, Select, PrimaryButton, SecondaryButton, Panel, ErrorState } from "@/components/ui";

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
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-accent-ink/50 p-4">
      <Panel className="max-h-[90vh] w-full max-w-2xl overflow-auto p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink">{isEdit ? "Edit Obligasi" : "Tambah Obligasi Baru"}</h2>
          <button onClick={onClose} className="text-ink-faint hover:text-ink" aria-label="Tutup">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <ErrorState message={error} />}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Nama Obligasi">
              <TextInput value={form.name} onChange={(e) => update("name", e.target.value)} required />
            </Field>
            <Field label="Refinitiv Ticker">
              <TextInput value={form.refinitivTicker} onChange={(e) => update("refinitivTicker", e.target.value)} />
            </Field>
            <Field label="Mata Uang">
              <Select value={form.currency} onChange={(e) => update("currency", e.target.value as FormState["currency"])}>
                <option value="IDR">IDR</option>
                <option value="USD">USD</option>
              </Select>
            </Field>
            <Field label="Kupon (%)">
              <TextInput type="number" step="0.0001" value={form.couponRate} onChange={(e) => update("couponRate", e.target.value)} required />
            </Field>
            <Field label="Frekuensi Kupon">
              <Select value={form.couponFrequency} onChange={(e) => update("couponFrequency", e.target.value as FormState["couponFrequency"])}>
                <option value="Annually">Annually</option>
                <option value="Semiannually">Semiannually</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Monthly">Monthly</option>
              </Select>
            </Field>
            <Field label="ISIN Code">
              <TextInput value={form.isinCode} onChange={(e) => update("isinCode", e.target.value)} />
            </Field>
            <Field label="Tanggal Penerbitan">
              <TextInput type="date" value={form.issueDate} onChange={(e) => update("issueDate", e.target.value)} required />
            </Field>
            <Field label="Tanggal Jatuh Tempo">
              <TextInput type="date" value={form.maturityDate} onChange={(e) => update("maturityDate", e.target.value)} required />
            </Field>
            <Field label="Moody's Rating">
              <TextInput value={form.moodysRating} onChange={(e) => update("moodysRating", e.target.value)} />
            </Field>
            <Field label="Moody's Outlook">
              <TextInput value={form.moodysOutlook} onChange={(e) => update("moodysOutlook", e.target.value)} />
            </Field>
            <Field label="S&P Rating">
              <TextInput value={form.spRating} onChange={(e) => update("spRating", e.target.value)} />
            </Field>
            <Field label="S&P Outlook">
              <TextInput value={form.spOutlook} onChange={(e) => update("spOutlook", e.target.value)} />
            </Field>
          </div>

          <div className="rounded border border-border p-4">
            <Field label="Tipe Kupon Awal">
              <Select value={form.couponType} onChange={(e) => update("couponType", e.target.value as FormState["couponType"])}>
                <option value="REGULAR">REGULAR</option>
                <option value="LONG">LONG</option>
                <option value="SHORT">SHORT</option>
              </Select>
            </Field>
            {isStub && (
              <div className="mt-3 space-y-3">
                <Field label="Tanggal Kupon Pertama">
                  <TextInput type="date" value={form.firstCouponDate} onChange={(e) => update("firstCouponDate", e.target.value)} required />
                </Field>
                <label className="flex items-center gap-2 text-sm text-ink">
                  <input type="checkbox" checked={form.hasLockUp} onChange={(e) => update("hasLockUp", e.target.checked)} />
                  Obligasi memiliki masa Lock-Up (tidak dapat dijual sebelum kupon pertama)
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <SecondaryButton type="button" onClick={onClose}>
              Batal
            </SecondaryButton>
            <PrimaryButton type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : "Simpan"}
            </PrimaryButton>
          </div>
        </form>
      </Panel>
    </div>
  );
}
