/**
 * Password gate for the "Database Obligasi" page (view/add/edit/delete),
 * kept separate from the read-only bond search API that Subscription/
 * Redemption/Switching all depend on -- locking that down too would break
 * every calculator, not just the admin page.
 *
 * The password itself is never stored -- only an HMAC-SHA256 of it, keyed by
 * DB_AUTH_SECRET (a server-only env var, never shipped to the client bundle).
 * A successful login issues a signed, expiring session token (same HMAC key)
 * carried in an HttpOnly cookie, verified on every protected request. Uses
 * Web Crypto (crypto.subtle) instead of Node's `crypto` module so this file
 * works unchanged in both the Node API route and the Edge-capable proxy.
 */

const COOKIE_NAME = "db_auth";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} for database auth.`);
  return value;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
  ]);
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verifyPassword(password: string): Promise<boolean> {
  const secret = requireEnv("DB_AUTH_SECRET");
  const expected = requireEnv("DB_ACCESS_PASSWORD_HASH");
  const actual = await hmacHex(secret, password);
  return timingSafeEqual(actual, expected);
}

export async function createSessionToken(): Promise<string> {
  const secret = requireEnv("DB_AUTH_SECRET");
  const expiry = Date.now() + SESSION_TTL_SECONDS * 1000;
  const signature = await hmacHex(secret, String(expiry));
  return `${expiry}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [expiryStr, signature] = token.split(".");
  if (!expiryStr || !signature) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  const secret = requireEnv("DB_AUTH_SECRET");
  const expected = await hmacHex(secret, expiryStr);
  return timingSafeEqual(expected, signature);
}

export const DB_AUTH_COOKIE = COOKIE_NAME;
export const DB_AUTH_MAX_AGE = SESSION_TTL_SECONDS;
