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

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
