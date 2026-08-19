import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, DB_AUTH_COOKIE } from "@/lib/dbAuth";

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Gates the "Database Obligasi" page and its write endpoints behind a
 * password. GET /api/bonds (search) stays open -- Subscription/Redemption/
 * Switching all depend on it to look up bonds, and that's normal calculator
 * use, not "database access" in the sense the password protects.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isBondsPage = pathname === "/bonds";
  const isBondsWrite = pathname.startsWith("/api/bonds") && WRITE_METHODS.has(request.method);

  if (!isBondsPage && !isBondsWrite) return NextResponse.next();

  const token = request.cookies.get(DB_AUTH_COOKIE)?.value;
  const authed = await verifySessionToken(token).catch(() => false);
  if (authed) return NextResponse.next();

  if (isBondsWrite) {
    return NextResponse.json({ error: "Butuh autentikasi untuk mengubah database obligasi." }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/bonds/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/bonds", "/api/bonds", "/api/bonds/:path*"],
};
