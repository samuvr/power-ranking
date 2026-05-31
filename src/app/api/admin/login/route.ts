import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AdminLoginSchema } from "@/lib/schemas";
import {
  checkAdminPassword,
  createAdminSessionToken,
  setAdminSessionCookie,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
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
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  const token = await createAdminSessionToken();
  await setAdminSessionCookie(token);
  return NextResponse.json({ ok: true });
}
