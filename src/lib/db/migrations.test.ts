import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// Todo `src/lib/db` habla con Postgres a través de `@vercel/postgres`. Al
// sustituirlo por el adaptador de PGlite, tanto las migraciones como las
// consultas del cliente corren contra un Postgres real dentro del test.
vi.mock("@vercel/postgres", () => import("./test-db"));

import { closeTestDb, resetTestDb, sql } from "./test-db";
import { runMigrations } from "./migrations";
import {
  adoptDataByEmail,
  createSnapshot,
  createUser,
  deleteSnapshot,
  getLatestSnapshot,
  getLatestSnapshotEntryByEmail,
  getPreviousSnapshot,
  getPreviousSnapshotEntryByEmail,
  getRankingById,
  getRankingByUser,
  getRankingWithPreviousById,
  getRankingsByVoting,
  getSnapshotById,
  getSnapshotEntriesByUser,
  getSnapshotEntries,
  getSnapshotEntryById,
  getSnapshotEntryByUser,
  getUserByEmail,
  getUserById,
  getVoting,
  getVotingPublic,
  listSnapshots,
  listUsers,
  renameSnapshot,
  updateUserName,
  updateUserPassword,
  updateVoting,
  upsertRanking,
} from "./client";
import { getTeamAbbrs } from "../../data/teams";

const SEED_VOTING_ID = "11111111-1111-1111-1111-111111111111";
const TEAMS = getTeamAbbrs();
const REVERSED = [...TEAMS].reverse();

const migrate = () => runMigrations({ log: () => {} });

async function tableNames(): Promise<string[]> {
  const r = await sql<{ table_name: string }>`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' ORDER BY table_name
  `;
  return r.rows.map((row) => row.table_name);
}

async function columnNames(table: string): Promise<string[]> {
  const r = await sql<{ column_name: string }>`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
    ORDER BY column_name
  `;
  return r.rows.map((row) => row.column_name);
}

/** `now()` es el mismo dentro de una transacción: fijamos fechas a mano. */
async function setSnapshotDate(id: string, iso: string): Promise<void> {
  await sql`UPDATE snapshots SET created_at = ${iso}::timestamptz WHERE id = ${id};`;
}

beforeEach(async () => {
  await resetTestDb();
});

afterAll(async () => {
  await closeTestDb();
});

describe("runMigrations", () => {
  it("crea el esquema entero desde una base de datos vacía", async () => {
    const log = await migrate();

    expect(await tableNames()).toEqual([
      "rankings",
      "snapshot_entries",
      "snapshots",
      "users",
      "votings",
    ]);
    expect(log.at(-1)).toContain("provisional");
  });

  it("siembra exactamente una votación, la de NFL Alicante", async () => {
    await migrate();

    const voting = await getVoting();
    expect(voting?.id).toBe(SEED_VOTING_ID);
    expect(voting?.slug).toBe("nfl-alicante");
    expect(voting?.active).toBe(true);
    expect(voting?.public_access).toBe(false);

    const count = await sql<{ n: number }>`SELECT COUNT(*)::int AS n FROM votings`;
    expect(count.rows[0].n).toBe(1);
  });

  it("es idempotente: correrla dos veces no cambia nada ni falla", async () => {
    await migrate();
    const before = await getVoting();

    const secondRun = await migrate();

    const after = await getVoting();
    expect(after).toEqual(before);
    // La contraseña provisional solo se genera al crear la fila.
    expect(secondRun.some((line) => line.includes("provisional"))).toBe(false);

    const count = await sql<{ n: number }>`SELECT COUNT(*)::int AS n FROM votings`;
    expect(count.rows[0].n).toBe(1);
  });

  it("no pisa los ajustes de la votación al volver a migrar", async () => {
    await migrate();
    await updateVoting(SEED_VOTING_ID, { name: "NFL Alicante 2027", publicAccess: true });

    await migrate();

    const voting = await getVoting();
    expect(voting?.name).toBe("NFL Alicante 2027");
    expect(voting?.public_access).toBe(true);
  });

  // El fallo del PR #11: las columnas nuevas vivían dentro de la rama "la
  // tabla no existía", así que una base de datos ya creada nunca las recibía y
  // `upsertRanking` moría con 42703 al guardar.
  it("añade las columnas nuevas a una base de datos que ya tenía las tablas", async () => {
    await migrate();
    await sql`ALTER TABLE rankings DROP COLUMN previous_positions;`;
    await sql`ALTER TABLE rankings DROP COLUMN previous_saved_at;`;
    await sql`ALTER TABLE rankings DROP COLUMN user_id;`;

    await migrate();

    const cols = await columnNames("rankings");
    expect(cols).toContain("previous_positions");
    expect(cols).toContain("previous_saved_at");
    expect(cols).toContain("user_id");
  });

  it("borra las columnas de la época multi-votación", async () => {
    await migrate();
    await sql`ALTER TABLE votings ADD COLUMN position INTEGER;`;
    await sql`ALTER TABLE votings ADD COLUMN admin_password_hash TEXT;`;

    await migrate();

    const cols = await columnNames("votings");
    expect(cols).not.toContain("position");
    expect(cols).not.toContain("admin_password_hash");
  });

  it("convierte el enum `voting_type` heredado en la clave foránea UUID", async () => {
    // Esquema anterior al PR #1, tal y como quedó en producción.
    await sql`CREATE TYPE voting_type AS ENUM ('nfl_alicante', 'otra_liga');`;
    await sql`
      CREATE TABLE rankings (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name   TEXT NOT NULL,
        email       TEXT NOT NULL,
        voting      voting_type NOT NULL,
        positions   JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`
      INSERT INTO rankings (full_name, email, voting, positions)
      VALUES ('Vieja Guardia', 'vieja@example.com', 'nfl_alicante', ${JSON.stringify(TEAMS)}::jsonb),
             ('Liga Muerta', 'muerta@example.com', 'otra_liga', ${JSON.stringify(TEAMS)}::jsonb);
    `;

    await migrate();

    const rows = await getRankingsByVoting(SEED_VOTING_ID);
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("vieja@example.com");
    expect(rows[0].positions).toEqual(TEAMS);

    // El tipo enum desaparece y la columna pasa a ser la FK a votings.
    const type = await sql<{ udt_name: string }>`
      SELECT udt_name FROM information_schema.columns
      WHERE table_name = 'rankings' AND column_name = 'voting'
    `;
    expect(type.rows[0].udt_name).toBe("uuid");
  });

  it("el ranking heredado se adopta al registrarse con ese email", async () => {
    await sql`CREATE TYPE voting_type AS ENUM ('nfl_alicante');`;
    await sql`
      CREATE TABLE rankings (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name   TEXT NOT NULL,
        email       TEXT NOT NULL,
        voting      voting_type NOT NULL,
        positions   JSONB NOT NULL,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `;
    await sql`
      INSERT INTO rankings (full_name, email, voting, positions)
      VALUES ('Vieja Guardia', 'vieja@example.com', 'nfl_alicante', ${JSON.stringify(TEAMS)}::jsonb);
    `;
    await migrate();

    const user = await createUser({
      fullName: "Vieja Guardia",
      email: "vieja@example.com",
      passwordHash: "hash",
    });
    await adoptDataByEmail(user.id, user.email);

    const adopted = await getRankingByUser(user.id, SEED_VOTING_ID);
    expect(adopted?.email).toBe("vieja@example.com");
  });
});

// Lo que ninguna prueba unitaria puede ver: que cada consulta de `client.ts`
// case con el esquema que deja `runMigrations`. Es exactamente el hueco por el
// que se coló el "Database error" del PR #11.
describe("el cliente de BD contra el esquema recién migrado", () => {
  beforeEach(async () => {
    await migrate();
  });

  it("guarda un ranking y conserva la versión anterior para el vídeo", async () => {
    const user = await createUser({
      fullName: "Ana Ejemplo",
      email: "ana@example.com",
      passwordHash: "hash",
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const first = await upsertRanking({
      fullName: user.full_name,
      email: user.email,
      userId: user.id,
      voting: SEED_VOTING_ID,
      positions: TEAMS,
    });
    const second = await upsertRanking({
      fullName: user.full_name,
      email: user.email,
      userId: user.id,
      voting: SEED_VOTING_ID,
      positions: REVERSED,
    });

    // Un único ranking por (email, votación): el upsert actualiza, no duplica.
    expect(second.id).toBe(first.id);

    const saved = await getRankingWithPreviousById(second.id);
    expect(saved?.positions).toEqual(REVERSED);
    expect(saved?.previous_positions).toEqual(TEAMS);
    expect(saved?.previous_saved_at).not.toBeNull();
    // Si hubiese hecho falta el plan B por columnas ausentes, habría avisado.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it("no pisa la versión anterior si se reenvía el mismo orden", async () => {
    const { id } = await upsertRanking({
      fullName: "Ana Ejemplo",
      email: "ana@example.com",
      userId: null,
      voting: SEED_VOTING_ID,
      positions: TEAMS,
    });
    await upsertRanking({
      fullName: "Ana Ejemplo",
      email: "ana@example.com",
      userId: null,
      voting: SEED_VOTING_ID,
      positions: TEAMS,
    });

    const saved = await getRankingWithPreviousById(id);
    expect(saved?.previous_positions).toBeNull();
  });

  it("congela un screenshot con sus entradas y lo borra en cascada", async () => {
    const user = await createUser({
      fullName: "Ana Ejemplo",
      email: "ana@example.com",
      passwordHash: "hash",
    });

    const older = await createSnapshot({
      voting: SEED_VOTING_ID,
      name: "Semana 1",
      consensus: TEAMS,
      entries: [
        { userId: user.id, fullName: user.full_name, email: user.email, positions: TEAMS },
        { userId: null, fullName: "Sin Cuenta", email: "sin@example.com", positions: REVERSED },
      ],
    });
    await setSnapshotDate(older.id, "2026-09-01T10:00:00Z");

    const newer = await createSnapshot({
      voting: SEED_VOTING_ID,
      name: "Semana 2",
      consensus: REVERSED,
      entries: [
        { userId: user.id, fullName: user.full_name, email: user.email, positions: REVERSED },
      ],
    });
    await setSnapshotDate(newer.id, "2026-09-08T10:00:00Z");

    expect((await listSnapshots(SEED_VOTING_ID)).map((s) => s.name)).toEqual([
      "Semana 2",
      "Semana 1",
    ]);
    expect((await getLatestSnapshot(SEED_VOTING_ID))?.name).toBe("Semana 2");
    expect((await getSnapshotById(older.id))?.entry_count).toBe(2);
    expect((await getSnapshotEntries(older.id)).map((e) => e.full_name)).toEqual([
      "Ana Ejemplo",
      "Sin Cuenta",
    ]);

    const stored = await getSnapshotById(newer.id);
    expect(stored?.consensus).toEqual(REVERSED);
    expect(
      (await getPreviousSnapshot(SEED_VOTING_ID, stored!.created_at))?.name,
    ).toBe("Semana 1");

    await deleteSnapshot(older.id);
    expect(await getSnapshotEntries(older.id)).toEqual([]);
  });

  it("resuelve las entradas de un votante por usuario y por email", async () => {
    const user = await createUser({
      fullName: "Ana Ejemplo",
      email: "ana@example.com",
      passwordHash: "hash",
    });
    const older = await createSnapshot({
      voting: SEED_VOTING_ID,
      name: "Semana 1",
      consensus: TEAMS,
      entries: [
        { userId: user.id, fullName: user.full_name, email: user.email, positions: TEAMS },
      ],
    });
    await setSnapshotDate(older.id, "2026-09-01T10:00:00Z");
    const newer = await createSnapshot({
      voting: SEED_VOTING_ID,
      name: "Semana 2",
      consensus: REVERSED,
      entries: [
        { userId: user.id, fullName: user.full_name, email: user.email, positions: REVERSED },
      ],
    });
    await setSnapshotDate(newer.id, "2026-09-08T10:00:00Z");

    const byUser = await getSnapshotEntryByUser(newer.id, user.id);
    expect(byUser?.positions).toEqual(REVERSED);
    expect((await getSnapshotEntryById(byUser!.id))?.email).toBe("ana@example.com");

    const history = await getSnapshotEntriesByUser(user.id, SEED_VOTING_ID);
    expect(history.map((e) => e.snapshot_name)).toEqual(["Semana 2", "Semana 1"]);

    const latest = await getLatestSnapshotEntryByEmail("ana@example.com", SEED_VOTING_ID);
    expect(latest?.snapshot_name).toBe("Semana 2");

    const previous = await getPreviousSnapshotEntryByEmail(
      "ana@example.com",
      SEED_VOTING_ID,
      (await getSnapshotById(newer.id))!.created_at,
    );
    expect(previous?.snapshot_name).toBe("Semana 1");

    await renameSnapshot(newer.id, "Post-Cortes");
    expect((await getSnapshotById(newer.id))?.name).toBe("Post-Cortes");
  });

  it("lista los usuarios con su último guardado y sus screenshots", async () => {
    const user = await createUser({
      fullName: "Ana Ejemplo",
      email: "ana@example.com",
      passwordHash: "hash",
    });
    await upsertRanking({
      fullName: user.full_name,
      email: user.email,
      userId: user.id,
      voting: SEED_VOTING_ID,
      positions: TEAMS,
    });
    await createSnapshot({
      voting: SEED_VOTING_ID,
      name: "Semana 1",
      consensus: TEAMS,
      entries: [
        { userId: user.id, fullName: user.full_name, email: user.email, positions: TEAMS },
      ],
    });

    const [listed] = await listUsers(SEED_VOTING_ID);
    expect(listed.full_name).toBe("Ana Ejemplo");
    expect(listed.snapshot_count).toBe(1);
    expect(listed.ranking_updated_at).not.toBeNull();
  });

  it("propaga el cambio de nombre al ranking y guarda la nueva contraseña", async () => {
    const user = await createUser({
      fullName: "Ana Ejemplo",
      email: "ana@example.com",
      passwordHash: "hash",
    });
    const { id } = await upsertRanking({
      fullName: user.full_name,
      email: user.email,
      userId: user.id,
      voting: SEED_VOTING_ID,
      positions: TEAMS,
    });

    await updateUserName(user.id, "Ana Nueva");
    await updateUserPassword(user.id, "hash2");

    expect((await getRankingById(id))?.full_name).toBe("Ana Nueva");
    expect((await getUserById(user.id))?.full_name).toBe("Ana Nueva");
    expect((await getUserByEmail("ana@example.com"))?.password_hash).toBe("hash2");
  });

  it("nunca devuelve el hash de la votación en la versión pública", async () => {
    const publicVoting = await getVotingPublic();
    expect(publicVoting).not.toBeNull();
    expect(publicVoting).not.toHaveProperty("voter_password_hash");
  });
});
