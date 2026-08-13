import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { VotingUpdateSchema } from "@/lib/schemas";
import { getVoting, updateVoting } from "@/lib/db/client";
import { hashPassword } from "@/lib/voting-access";
import { isAdminAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
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
    data = VotingUpdateSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const current = await getVoting();
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const voterPasswordHash = data.voterPassword
    ? await hashPassword(data.voterPassword)
    : undefined;

  await updateVoting(current.id, {
    name: data.name,
    shortName: data.shortName,
    description: data.description,
    accent: data.accent,
    accentDark: data.accentDark,
    logoUrl: data.logoUrl,
    active: data.active,
    publicAccess: data.publicAccess,
    voterPasswordHash,
  });

  return NextResponse.json({ ok: true });
}
