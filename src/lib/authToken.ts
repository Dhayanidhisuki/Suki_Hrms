import jwt from "jsonwebtoken";
import {
  AUTH_COOKIE_NAME,
  getAuthJwtSecret,
  getAuthJwtTtlSeconds,
  type AuthTokenPayload,
} from "./authTypes";

export { AUTH_COOKIE_NAME, type AuthTokenPayload };

/** Sign a JWT for Node API routes (jsonwebtoken). */
export function signAuthToken(payload: AuthTokenPayload): {
  token: string;
  maxAge: number;
} {
  const maxAge = getAuthJwtTtlSeconds();
  const token = jwt.sign(payload, getAuthJwtSecret(), {
    expiresIn: maxAge,
    algorithm: "HS256",
  });
  return { token, maxAge };
}

/** Verify a JWT in Node API routes. Returns null if invalid/expired. */
export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    const decoded = jwt.verify(token, getAuthJwtSecret(), {
      algorithms: ["HS256"],
    });
    if (typeof decoded !== "object" || decoded === null) return null;
    const sub = Number((decoded as jwt.JwtPayload).sub);
    const username = (decoded as jwt.JwtPayload).username;
    const name = (decoded as jwt.JwtPayload).name;
    const role = (decoded as jwt.JwtPayload).role;
    if (!Number.isFinite(sub) || typeof username !== "string") return null;
    if (typeof name !== "string" || typeof role !== "string") return null;
    return { sub, username, name, role };
  } catch {
    return null;
  }
}

/**
 * Cookie flags for the JWT session.
 * Prefer request-derived `secure` (HTTPS / x-forwarded-proto) so public tunnels
 * work in development without breaking plain http://localhost.
 */
export function authCookieOptions(
  maxAge: number,
  options?: { secure?: boolean }
) {
  const secure =
    options?.secure ??
    (process.env.AUTH_COOKIE_SECURE === "true" ||
      process.env.NODE_ENV === "production");
  return {
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

/** True when the incoming request is HTTPS (incl. Cloudflare / reverse proxies). */
export function requestIsHttps(req: {
  headers: { get(name: string): string | null };
  nextUrl?: { protocol?: string };
}): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto.toLowerCase() === "https";
  const urlProto = req.nextUrl?.protocol;
  if (urlProto) return urlProto === "https:";
  return false;
}
