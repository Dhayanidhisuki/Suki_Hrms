/**
 * JWT utilities — dual library strategy:
 * - jose:   For Edge Runtime (Next.js middleware runs on Edge)
 * - jsonwebtoken: For Node.js Runtime (API routes, server actions)
 *
 * Both use the same JWT_SECRET and produce/verify compatible tokens.
 */

// ─── jose (Edge Runtime) ─────────────────────────────────────────────────────

import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'suki-hrms-super-secret-jwt-key'
);

const expiresIn = '24h';

export interface TokenPayload extends JWTPayload {
  userId: number;
  roleId: number;
  roleCode: string;
}

/** Sign a JWT using jose (Edge-compatible). Use in middleware/server components. */
export async function signTokenJose(payload: Omit<TokenPayload, 'iat' | 'exp'>): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secret);
}

/** Verify a JWT using jose (Edge-compatible). Use in middleware. */
export async function verifyTokenJose(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as TokenPayload;
  } catch {
    return null;
  }
}

// ─── jsonwebtoken (Node.js Runtime) ──────────────────────────────────────────

import jwt from 'jsonwebtoken';

const nodeSecret = process.env.JWT_SECRET ?? 'suki-hrms-super-secret-jwt-key';

/** Sign a JWT using jsonwebtoken (Node-only). Use in API routes / server actions. */
export function signTokenNode(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload, nodeSecret, { expiresIn });
}

/** Verify a JWT using jsonwebtoken (Node-only). Use in API routes. */
export function verifyTokenNode(token: string): TokenPayload | null {
  try {
    const payload = jwt.verify(token, nodeSecret) as TokenPayload;
    return payload;
  } catch {
    return null;
  }
}
