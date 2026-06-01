import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { DuplicateRankingsSchema } from "@/lib/schemas";
import { copyRankingsBetweenVotings, getVotingById } from "@/lib/db/client";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

// POST /api/admin/votings/[id]/duplicate — copia los rankings de la votación
// [id] (origen) a la votación targetVotingId (destino), saltando los emails
// que ya votaron en destino. Solo superadmin (protegido por middleware).
export async function POST(req: Request, { params }: { params: Params }) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let data;
  try {
    data = DuplicateRankingsSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  if (id === data.targetVotingId) {
    return NextResponse.json(
      { error: "El origen y el destino deben ser distintos" },
      { status: 400 },
    );
  }

  const [source, target] = await Promise.all([
    getVotingById(id),
    getVotingById(data.targetVotingId),
  ]);

  if (!source || !target) {
    return NextResponse.json({ error: "Votación no encontrada" }, { status: 404 });
  }

  const result = await copyRankingsBetweenVotings(source.id, target.id);

  return NextResponse.json(result);
}
