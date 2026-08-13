import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { LoginSchema } from "@/lib/schemas";
import { getUserByEmail } from "@/lib/db/client";
import { verifyPassword } from "@/lib/voting-access";
import { setUserSessionCookie } from "@/lib/user-auth";

export const runtime = "nodejs";

// Mismo mensaje para email inexistente y contraseña incorrecta: no filtramos
// qué emails están registrados.
const INVALID = "Email o contraseña incorrectos";

export async function POST(req: Request) {
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

  const user = await getUserByEmail(data.email);
  const ok = user ? await verifyPassword(data.password, user.password_hash) : false;
  if (!user || !ok) {
    return NextResponse.json({ error: INVALID }, { status: 401 });
  }

  await setUserSessionCookie(user.id);
  return NextResponse.json({ ok: true });
}
