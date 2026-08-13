import { NextResponse } from "next/server";
import { getRankingsByVoting, getVoting } from "@/lib/db/client";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const voting = await getVoting();
  if (!voting) {
    return NextResponse.json({ error: "Unknown voting" }, { status: 404 });
  }

  const rows = await getRankingsByVoting(voting.id);
  const result = computeGlobalRanking(rows.map((r) => r.positions));

  return NextResponse.json({
    ...result,
    voters: rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    })),
  });
}
