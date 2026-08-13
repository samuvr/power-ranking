import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { RankingSubmissionSchema } from "@/lib/schemas";
import { getVoting, upsertRanking } from "@/lib/db/client";
import { hasVoterAccess } from "@/lib/voting-access";
import { isAdminAuthenticated } from "@/lib/auth";

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

  const isAdmin = await isAdminAuthenticated();
  const isVoter = await hasVoterAccess(voting.id);
  if (!isAdmin && !isVoter) {
    return NextResponse.json({ error: "Sin acceso a la votación" }, { status: 401 });
  }

  try {
    const { id } = await upsertRanking({ ...data, voting: voting.id });
    return NextResponse.json({ id });
  } catch (err) {
    console.error("Failed to upsert ranking", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
