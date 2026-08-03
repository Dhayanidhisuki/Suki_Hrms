import bcrypt from "bcryptjs";

const ROUNDS = 12;

/** Hash a plain-text password for storage. Single source of truth for hashing. */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

/** Verify a plain-text password against a stored bcrypt hash. */
export async function verifyPassword(
  plain: string,
  passwordHash: string
): Promise<boolean> {
  if (!passwordHash) return false;
  return bcrypt.compare(plain, passwordHash);
}
