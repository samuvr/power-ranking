import { NextResponse } from "next/server";
import { runMigrations } from "@/lib/db/migrations";
import { isAdminAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Las migraciones son DDL idempotente, pero pueden tardar más que el límite
// por defecto en una base de datos fría.
export const maxDuration = 60;

// Ejecuta las migraciones con las variables de entorno del propio despliegue:
// las credenciales de la base de datos son "sensitive" en Vercel y no se
// pueden bajar en local, así que este es el camino para actualizar el esquema.
export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const log = await runMigrations();
    return NextResponse.json({ ok: true, log });
  } catch (err) {
    const pg = err as { code?: string; message?: string };
    console.error("Migration failed", { code: pg?.code, message: pg?.message });
    return NextResponse.json(
      { error: pg?.message ?? "La migración ha fallado", code: pg?.code },
      { status: 500 },
    );
  }
}
