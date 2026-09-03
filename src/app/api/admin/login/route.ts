import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AdminLoginSchema } from "@/lib/schemas";
import {
  checkAdminPassword,
  createAdminSessionToken,
  setAdminSessionCookie,
} from "@/lib/auth";
import { checkRateLimit, clientIp, consumeAttempt, resetAttempts } from "@/lib/rate-limit";
import { ADMIN_LOGIN_IP_RULE, tooManyAttempts } from "@/lib/auth-throttle";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const ipKey = `admin-login:ip:${clientIp(req)}`;
  const ipState = checkRateLimit(ipKey, ADMIN_LOGIN_IP_RULE);
  if (!ipState.allowed) return tooManyAttempts(ipState);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let data;
  try {
    data = AdminLoginSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }

  if (!checkAdminPassword(data.password.trim())) {
    consumeAttempt(ipKey, ADMIN_LOGIN_IP_RULE);
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  resetAttempts(ipKey);
  const token = await createAdminSessionToken();
  await setAdminSessionCookie(token);
  return NextResponse.json({ ok: true });
}
