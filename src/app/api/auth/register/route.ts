import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RegisterSchema } from "@/lib/schemas";
import { adoptDataByEmail, createUser, getUserByEmail, getVoting } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/voting-access";
import { setUserSessionCookie } from "@/lib/user-auth";

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
    data = RegisterSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Datos inválidos", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const voting = await getVoting();
  if (!voting) {
    return NextResponse.json({ error: "Votación no disponible" }, { status: 404 });
  }

  // El registro sigue cerrado a la comunidad salvo que la votación sea pública.
  if (!voting.public_access) {
    if (!data.votingPassword) {
      return NextResponse.json(
        { error: "Introduce la contraseña de la comunidad" },
        { status: 400 },
      );
    }
    const ok = await verifyPassword(data.votingPassword, voting.voter_password_hash);
    if (!ok) {
      return NextResponse.json(
        { error: "Contraseña de la comunidad incorrecta" },
        { status: 401 },
      );
    }
  }

  const existing = await getUserByEmail(data.email);
  if (existing) {
    return NextResponse.json(
      { error: "Ya hay una cuenta con ese email. Inicia sesión." },
      { status: 409 },
    );
  }

  try {
    const passwordHash = await hashPassword(data.password);
    const user = await createUser({
      fullName: data.fullName,
      email: data.email,
      passwordHash,
    });
    // Rankings y screenshots previos con ese email pasan a ser suyos.
    await adoptDataByEmail(user.id, user.email);
    await setUserSessionCookie(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to register user", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
