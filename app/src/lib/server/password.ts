import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashes use scrypt with a per-password salt: "scrypt$N$r$p$<salt base64>$<hash base64>".
// Plain passwords are never stored or logged.
const KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024;

export function hashPassword(password: string, N = 16384, r = 8, p = 1): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEYLEN, { N, r, p, maxmem: MAXMEM });
  return ["scrypt", N, r, p, salt.toString("base64"), hash.toString("base64")].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  if (!expected.length) return false;
  try {
    const actual = scryptSync(password, Buffer.from(saltB64, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: MAXMEM });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
