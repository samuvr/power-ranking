import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SnapshotCreateSchema } from "@/lib/schemas";
import {
  createSnapshot,
  getLatestSnapshot,
  getRankingsByVoting,
  getVoting,
} from "@/lib/db/client";
import { isAdminAuthenticated } from "@/lib/auth";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";

export const runtime = "nodejs";

function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && err.code === "23505";
}

export async function POST(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let data;
  try {
    data = SnapshotCreateSchema.parse(body);
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

  const [rows, latest] = await Promise.all([
    getRankingsByVoting(voting.id),
    getLatestSnapshot(voting.id),
  ]);

  // Por defecto solo entra quien haya guardado después del último screenshot.
  const cutoff = latest ? new Date(latest.created_at).getTime() : null;
  const eligible =
    data.includeAll || cutoff === null
      ? rows
      : rows.filter((r) => new Date(r.updated_at).getTime() > cutoff);

  if (eligible.length === 0) {
    return NextResponse.json(
      { error: "No hay rankings que congelar con ese criterio" },
      { status: 400 },
    );
  }

  const { ranking } = computeGlobalRanking(eligible.map((r) => r.positions));
  const consensus = [...ranking]
    .sort((a, b) => a.finalPosition - b.finalPosition)
    .map((entry) => entry.teamAbbr);

  try {
    const { id } = await createSnapshot({
      voting: voting.id,
      name: data.name,
      consensus,
      entries: eligible.map((r) => ({
        userId: r.user_id,
        fullName: r.full_name,
        email: r.email,
        positions: r.positions,
      })),
    });
    return NextResponse.json({ id, entryCount: eligible.length });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "Ya existe un screenshot con ese nombre" },
        { status: 409 },
      );
    }
    console.error("Failed to create snapshot", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
