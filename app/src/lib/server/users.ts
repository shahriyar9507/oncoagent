import { verifyPassword } from "./password";
import type { SessionUser } from "../session";

// Accounts come from the environment, so no credential lives in the repository:
//   AUTH_USERS='[{"username":"...","passwordHash":"scrypt$...","name":"Dr. ...","role":"clinician"}]'
// or the single-account shorthand AUTH_USERNAME + AUTH_PASSWORD_HASH (+ AUTH_DISPLAY_NAME, AUTH_ROLE).
// Create a hash with: npm run hash-password -- "<password>"
export interface Account {
  username: string;
  passwordHash: string;
  name: string;
  role: string;
}

export function accounts(): Account[] {
  const list: Account[] = [];
  const raw = process.env.AUTH_USERS;
  if (raw) {
    try {
      for (const a of JSON.parse(raw) as Partial<Account>[]) {
        if (a.username && a.passwordHash) list.push({ username: a.username.toLowerCase(), passwordHash: a.passwordHash, name: a.name ?? a.username, role: a.role ?? "clinician" });
      }
    } catch {
      /* malformed AUTH_USERS is reported by /api/health */
    }
  }
  if (process.env.AUTH_USERNAME && process.env.AUTH_PASSWORD_HASH) {
    list.push({
      username: process.env.AUTH_USERNAME.toLowerCase(),
      passwordHash: process.env.AUTH_PASSWORD_HASH,
      name: process.env.AUTH_DISPLAY_NAME ?? process.env.AUTH_USERNAME,
      role: process.env.AUTH_ROLE ?? "clinician",
    });
  }
  return list;
}

// A syntactically valid hash that matches nothing, so unknown usernames cost the same scrypt time.
const DUMMY_HASH = "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

/** Check a username and password. Always performs one scrypt comparison so timing does not reveal valid usernames. */
export function authenticate(username: string, password: string): SessionUser | null {
  const user = accounts().find((a) => a.username === username.trim().toLowerCase());
  const ok = verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
  return user && ok ? { sub: user.username, name: user.name, role: user.role } : null;
}
