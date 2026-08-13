import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SnapshotRenameSchema } from "@/lib/schemas";
import { deleteSnapshot, getSnapshotById, renameSnapshot } from "@/lib/db/client";
import { isAdminAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
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
    data = SnapshotRenameSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? "Nombre inválido", details: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const snapshot = await getSnapshotById(id);
  if (!snapshot) {
    return NextResponse.json({ error: "Screenshot no encontrado" }, { status: 404 });
  }

  try {
    await renameSnapshot(id, data.name);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (typeof err === "object" && err !== null && "code" in err && err.code === "23505") {
      return NextResponse.json(
        { error: "Ya existe un screenshot con ese nombre" },
        { status: 409 },
      );
    }
    console.error("Failed to rename snapshot", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Params }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const snapshot = await getSnapshotById(id);
  if (!snapshot) {
    return NextResponse.json({ error: "Screenshot no encontrado" }, { status: 404 });
  }

  try {
    // Las entradas caen en cascada; borrar el más reciente cambia las flechas
    // de evolución de todo el mundo.
    await deleteSnapshot(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to delete snapshot", err);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
