import { NextResponse } from "next/server";
import { getLatestSnapshot, getRankingsByVoting, getVoting } from "@/lib/db/client";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { rankingsUpdatedAfter, snapshotCutoff } from "@/lib/ranking-pool";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const voting = await getVoting();
  if (!voting) {
    return NextResponse.json({ error: "Unknown voting" }, { status: 404 });
  }

  const [rows, latest] = await Promise.all([
    getRankingsByVoting(voting.id),
    getLatestSnapshot(voting.id),
  ]);
  const included = rankingsUpdatedAfter(rows, snapshotCutoff(latest));
  const includedIds = new Set(included.map((r) => r.id));
  const result = computeGlobalRanking(included.map((r) => r.positions));

  return NextResponse.json({
    ...result,
    voters: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      // Si su ranking ha entrado en el consenso (guardado tras el screenshot).
      includedInConsensus: includedIds.has(r.id),
    })),
  });
}
