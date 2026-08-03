/** Shared auth cookie + JWT payload types (Edge- and Node-safe — no Node-only imports). */

export const AUTH_COOKIE_NAME =
  process.env.AUTH_COOKIE_NAME ?? "suki_tools_token";

export interface AuthTokenPayload {
  sub: number;
  username: string;
  name: string;
  role: string;
}

export function getAuthJwtSecret(): string {
  const secret = process.env.AUTH_JWT_SECRET ?? process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_JWT_SECRET (or SESSION_SECRET) must be set and at least 32 characters"
    );
  }
  return secret;
}

export function getAuthJwtTtlSeconds(): number {
  return Number(
    process.env.AUTH_JWT_TTL_SECONDS ?? process.env.SESSION_TTL_SECONDS ?? 28800
  );
}
