"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Panel, Field, TextInput, PrimaryButton, ErrorState } from "@/components/ui";

export default function BondsLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/bonds";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/db-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Password salah.");
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Gagal menghubungi server.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-sm space-y-6 py-16">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-accent-strong">Akses Terbatas</p>
        <h1 className="mt-1 text-xl font-semibold text-ink">Database Obligasi</h1>
        <p className="mt-2 text-sm text-ink-muted">Masukkan password untuk melihat atau mengubah database obligasi.</p>
      </div>
      <Panel className="p-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Password">
            <TextInput
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
            />
          </Field>
          {error && <ErrorState message={error} />}
          <PrimaryButton type="submit" disabled={loading || !password} className="w-full">
            {loading ? "Memeriksa..." : "Masuk"}
          </PrimaryButton>
        </form>
      </Panel>
    </div>
  );
}
