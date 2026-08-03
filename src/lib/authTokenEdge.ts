import { jwtVerify } from "jose";
import {
  AUTH_COOKIE_NAME,
  getAuthJwtSecret,
  type AuthTokenPayload,
} from "./authTypes";

export { AUTH_COOKIE_NAME };

export type EdgeAuthResult =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "ok"; payload: AuthTokenPayload };

/** Verify JWT cookie at the Edge with jose (CRM/HRMS pattern). */
export async function verifyAuthTokenEdge(
  token: string | undefined
): Promise<EdgeAuthResult> {
  if (!token) return { status: "missing" };

  try {
    const secret = new TextEncoder().encode(getAuthJwtSecret());
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ["HS256"],
    });

    const sub = Number(payload.sub);
    const username = payload.username;
    const name = payload.name;
    const role = payload.role;

    if (!Number.isFinite(sub) || typeof username !== "string") {
      return { status: "invalid" };
    }
    if (typeof name !== "string" || typeof role !== "string") {
      return { status: "invalid" };
    }

    return {
      status: "ok",
      payload: { sub, username, name, role },
    };
  } catch {
    // Expired / bad signature / malformed
    return { status: "invalid" };
  }
}
