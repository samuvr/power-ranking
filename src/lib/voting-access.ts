import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SALT_ROUNDS = 10;
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 12; // 12h

export type VotingRole = "voter";

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("SESSION_SECRET must be set (>=16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  return bcrypt.compare(plain, hash);
}

export function voterCookieName(votingId: string): string {
  return `voter_access_${votingId}`;
}

async function signToken(votingId: string, role: VotingRole): Promise<string> {
  return new SignJWT({ votingId, role })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

async function verifyToken(
  token: string | undefined,
  votingId: string,
  role: VotingRole,
): Promise<boolean> {
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.role === role && payload.votingId === votingId;
  } catch {
    return false;
  }
}

export async function setVoterCookie(votingId: string): Promise<void> {
  const token = await signToken(votingId, "voter");
  const store = await cookies();
  store.set({
    name: voterCookieName(votingId),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE_SECONDS,
  });
}

export async function hasVoterAccess(votingId: string): Promise<boolean> {
  const store = await cookies();
  return verifyToken(store.get(voterCookieName(votingId))?.value, votingId, "voter");
}
