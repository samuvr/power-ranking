import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { getUserById, toPublicUser, type UserPublic } from "@/lib/db/client";
import { USER_COOKIE_NAME as COOKIE_NAME } from "@/lib/cookie-names";


// 30 días: la gente actualiza su ranking cada semana y no queremos que tenga
// que volver a iniciar sesión cada vez.
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (>=16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function createUserSessionToken(userId: string): Promise<string> {
  return new SignJWT({ role: "user" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function setUserSessionCookie(userId: string): Promise<void> {
  const token = await createUserSessionToken(userId);
  const store = await cookies();
  store.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function clearUserSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<string | null> {
  try {
    const store = await cookies();
    const token = store.get(COOKIE_NAME)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.role !== "user" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/**
 * Usuario de la sesión actual, o null. Devuelve null también si la cuenta ya
 * no existe (cookie válida pero usuario borrado).
 */
export async function getCurrentUser(): Promise<UserPublic | null> {
  const id = await getSessionUserId();
  if (!id) return null;
  const row = await getUserById(id);
  return row ? toPublicUser(row) : null;
}

export { COOKIE_NAME as USER_COOKIE_NAME };
