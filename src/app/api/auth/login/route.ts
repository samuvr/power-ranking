import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { LoginSchema } from "@/lib/schemas";
import { getUserByEmail } from "@/lib/db/client";
import { verifyPassword } from "@/lib/voting-access";
import { setUserSessionCookie } from "@/lib/user-auth";
import { checkRateLimit, clientIp, consumeAttempt, resetAttempts } from "@/lib/rate-limit";
import { LOGIN_EMAIL_RULE, LOGIN_IP_RULE, tooManyAttempts } from "@/lib/auth-throttle";

export const runtime = "nodejs";

// Mismo mensaje para email inexistente y contraseña incorrecta: no filtramos
// qué emails están registrados.
const INVALID = "Email o contraseña incorrectos";

export async function POST(req: Request) {
  const ip = clientIp(req);
  const ipKey = `login:ip:${ip}`;
  const ipState = checkRateLimit(ipKey, LOGIN_IP_RULE);
  if (!ipState.allowed) return tooManyAttempts(ipState);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let data;
  try {
    data = LoginSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: INVALID }, { status: 401 });
    }
    throw err;
  }

  // El cupo por email se mira antes de tocar la base de datos y de gastar un
  // bcrypt, que es lo caro de cada intento.
  const emailKey = `login:email:${data.email}`;
  const emailState = checkRateLimit(emailKey, LOGIN_EMAIL_RULE);
  if (!emailState.allowed) return tooManyAttempts(emailState);

  const user = await getUserByEmail(data.email);
  const ok = user ? await verifyPassword(data.password, user.password_hash) : false;
  if (!user || !ok) {
    consumeAttempt(emailKey, LOGIN_EMAIL_RULE);
    consumeAttempt(ipKey, LOGIN_IP_RULE);
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  // Quien entra bien no arrastra los fallos anteriores.
  resetAttempts(emailKey);
  resetAttempts(ipKey);
  await setUserSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
