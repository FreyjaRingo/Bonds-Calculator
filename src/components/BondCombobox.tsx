"use client";

import { useEffect, useRef, useState } from "react";
import type { BondDTO } from "@/lib/types";

interface BondComboboxProps {
  value: BondDTO | null;
  onChange: (bond: BondDTO | null) => void;
}

export function BondCombobox({ value, onChange }: BondComboboxProps) {
  const [query, setQuery] = useState(value?.name ?? "");
  const [syncedValue, setSyncedValue] = useState(value);
  const [results, setResults] = useState<BondDTO[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  if (value !== syncedValue) {
    setSyncedValue(value);
    setQuery(value?.name ?? "");
  }

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setLoading(true);
      fetch(`/api/bonds?q=${encodeURIComponent(query)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: BondDTO[]) => setResults(data))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, open]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) onChange(null);
        }}
        placeholder="Cari nama obligasi atau ISIN..."
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      />
      {open && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-slate-200 bg-white shadow-lg">
          {loading && <div className="px-3 py-2 text-sm text-slate-400">Mencari...</div>}
          {!loading && results.length === 0 && (
            <div className="px-3 py-2 text-sm text-slate-400">Tidak ada obligasi ditemukan.</div>
          )}
          {!loading &&
            results.map((bond) => (
              <button
                key={bond.id}
                type="button"
                onClick={() => {
                  onChange(bond);
                  setQuery(bond.name);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-900">{bond.name}</span>
                <span className="text-xs text-slate-500">
                  {bond.currency} · kupon {(bond.couponRate * 100).toFixed(3)}% · JT {bond.maturityDate.slice(0, 10)}
                  {bond.isinCode ? ` · ${bond.isinCode}` : ""}
                </span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
