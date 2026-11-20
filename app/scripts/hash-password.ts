import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../src/lib/server/password";

// Prints an scrypt hash for AUTH_PASSWORD_HASH (or the passwordHash field of AUTH_USERS), plus a fresh AUTH_SECRET.
// Usage: npm run hash-password -- "<password>"
// The password is read from the command line or the OA_PASSWORD environment variable; it is never written anywhere.
const password = process.argv[2] ?? process.env.OA_PASSWORD;
if (!password) {
  console.error('Usage: npm run hash-password -- "<password>"');
  process.exit(1);
}
if (password.length < 8) console.error("Warning: use at least 8 characters for a real deployment.");
const hash = hashPassword(password);
if (!verifyPassword(password, hash)) throw new Error("self-check failed");
console.log(`AUTH_PASSWORD_HASH=${hash}`);
if (process.argv.includes("--secret")) console.log(`AUTH_SECRET=${randomBytes(48).toString("base64url")}`);
