import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createSessionToken, DB_AUTH_COOKIE, DB_AUTH_MAX_AGE } from "@/lib/dbAuth";

export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  let ok: boolean;
  try {
    ok = await verifyPassword(body.password ?? "");
  } catch (err) {
    console.error("Database auth is not configured:", err);
    return NextResponse.json({ error: "Proteksi database belum dikonfigurasi di server." }, { status: 500 });
  }

  if (!ok) {
    return NextResponse.json({ error: "Password salah." }, { status: 401 });
  }

  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(DB_AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DB_AUTH_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(DB_AUTH_COOKIE);
  return res;
}
