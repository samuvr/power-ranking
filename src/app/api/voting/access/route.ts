import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { VotingAccessSchema } from "@/lib/schemas";
import { getVoting } from "@/lib/db/client";
import { setVoterCookie, verifyPassword } from "@/lib/voting-access";

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
    data = VotingAccessSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    throw err;
  }

  const voting = await getVoting();
  if (!voting || !voting.active) {
    return NextResponse.json({ error: "Votación cerrada" }, { status: 404 });
  }

  if (!voting.public_access) {
    if (!data.password) {
      return NextResponse.json({ error: "Contraseña requerida" }, { status: 400 });
    }
    const ok = await verifyPassword(data.password, voting.voter_password_hash);
    if (!ok) {
      return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
    }
  }

  await setVoterCookie(voting.id);
  return NextResponse.json({ ok: true });
}
