import bcrypt from "bcryptjs";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

/* CR05 6.3: minimum 12 characters, at least one letter and one digit, and
   not in the small common-password list. */
const COMMON_PASSWORDS = new Set([
  "password1234",
  "password12345",
  "saudi1234567",
  "welcome12345",
  "123456789012",
  "qwerty123456",
  "letmein12345",
  "admin1234567",
  "enviroai-demo-2026",
  "changeme1234",
]);

export function passwordPolicyError(plain: string): string | null {
  if (plain.length < 12) return "too_short";
  if (!/[a-zA-Z؀-ۿ]/.test(plain)) return "needs_letter";
  if (!/\d/.test(plain)) return "needs_digit";
  if (COMMON_PASSWORDS.has(plain.toLowerCase())) return "too_common";
  return null;
}
