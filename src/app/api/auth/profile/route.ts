import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ProfileUpdateSchema } from "@/lib/schemas";
import { getUserById, updateUserName, updateUserPassword } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/voting-access";
import { getSessionUserId } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let data;
  try {
    data = ProfileUpdateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Datos inválidos", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Sin sesión" }, { status: 401 });
  }

  if (data.newPassword) {
    const ok = await verifyPassword(data.currentPassword ?? "", user.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "La contraseña actual no es correcta" }, { status: 401 });
    }
    await updateUserPassword(user.id, await hashPassword(data.newPassword));
  }

  if (data.fullName && data.fullName !== user.full_name) {
    await updateUserName(user.id, data.fullName);
  }

  return NextResponse.json({ ok: true });
}
