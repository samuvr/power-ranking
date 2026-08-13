import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AdminResetPasswordSchema } from "@/lib/schemas";
import { getUserById, updateUserPassword } from "@/lib/db/client";
import { isAdminAuthenticated } from "@/lib/auth";
import { hashPassword } from "@/lib/voting-access";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

// Reset manual: no hay envío de emails, así que el admin genera una
// contraseña temporal y el usuario la cambia desde /perfil.
export async function POST(req: Request, { params }: { params: Params }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let data;
  try {
    data = AdminResetPasswordSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Contraseña inválida", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const user = await getUserById(id);
  if (!user) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  await updateUserPassword(user.id, await hashPassword(data.password));
  return NextResponse.json({ ok: true });
}
