import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RankingSubmissionSchema } from "@/lib/schemas";
import { getUserById, getVoting, upsertRanking } from "@/lib/db/client";
import { getSessionUserId } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ error: "Inicia sesión para guardar tu ranking" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let data;
  try {
    data = RankingSubmissionSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const voting = await getVoting();
  if (!voting || !voting.active) {
    return NextResponse.json({ error: "Votación cerrada" }, { status: 404 });
  }

  const user = await getUserById(userId);
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para guardar tu ranking" }, { status: 401 });
  }

  try {
    // El nombre y el email salen de la cuenta, nunca del cuerpo de la petición.
    const { id } = await upsertRanking({
      fullName: user.full_name,
      email: user.email,
      userId: user.id,
      voting: voting.id,
      positions: data.positions,
    });
    return NextResponse.json({ id });
  } catch (err) {
    // El código y el detalle de Postgres son lo único que permite distinguir
    // una caída de la base de datos de un esquema sin migrar.
    const pg = err as { code?: string; detail?: string; message?: string };
    console.error("Failed to upsert ranking", {
      code: pg?.code,
      detail: pg?.detail,
      message: pg?.message,
      email: user.email,
    });
    return NextResponse.json(
      { error: "No se ha podido guardar tu ranking. Inténtalo de nuevo en unos segundos." },
      { status: 500 },
    );
  }
}
