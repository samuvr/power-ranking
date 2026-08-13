import { db, sql } from "@vercel/postgres";

export type VotingId = string;

// La app solo tiene una votación. Este es su slug canónico: se usa para
// localizar la fila en la tabla `votings`, que nunca debería tener más de una.
export const VOTING_SLUG = "nfl-alicante";

export type VotingRow = {
  id: VotingId;
  slug: string;
  name: string;
  short_name: string;
  description: string;
  accent: string;
  accent_dark: string;
  logo_url: string;
  voter_password_hash: string;
  active: boolean;
  public_access: boolean;
  created_at: string;
  updated_at: string;
};

export type VotingPublic = Omit<VotingRow, "voter_password_hash">;

export type RankingRow = {
  id: string;
  full_name: string;
  email: string;
  user_id: string | null;
  voting: VotingId;
  positions: string[];
  created_at: string;
  updated_at: string;
};

export type UserRow = {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
};

export type UserPublic = Omit<UserRow, "password_hash">;

// Foto congelada de la votación en un momento concreto ("Week 1", …).
// `consensus` es el ranking global tal cual se calculó al crearla: no se
// recalcula nunca, aunque después cambien los rankings de los usuarios.
export type SnapshotRow = {
  id: string;
  voting: VotingId;
  name: string;
  consensus: string[];
  entry_count: number;
  created_at: string;
};

export type SnapshotEntryRow = {
  id: string;
  snapshot_id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  positions: string[];
  created_at: string;
};

export function toPublicUser(row: UserRow): UserPublic {
  const { password_hash: _p, ...rest } = row;
  void _p;
  return rest;
}

export function toPublicVoting(row: VotingRow): VotingPublic {
  const { voter_password_hash: _v, ...rest } = row;
  void _v;
  return rest;
}

// Devuelve la única votación. Prioriza el slug canónico por si quedara
// alguna fila antigua sin limpiar, y cae en la más antigua en caso contrario.
export async function getVoting(): Promise<VotingRow | null> {
  const r = await sql<VotingRow>`
    SELECT id, slug, name, short_name, description, accent, accent_dark, logo_url,
           voter_password_hash, active, public_access, created_at, updated_at
    FROM votings
    ORDER BY CASE WHEN slug = ${VOTING_SLUG} THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1;
  `;
  return r.rows[0] ?? null;
}

export async function getVotingPublic(): Promise<VotingPublic | null> {
  const row = await getVoting();
  return row ? toPublicVoting(row) : null;
}

export type VotingUpdate = {
  name?: string;
  shortName?: string;
  description?: string;
  accent?: string;
  accentDark?: string;
  logoUrl?: string;
  active?: boolean;
  publicAccess?: boolean;
  voterPasswordHash?: string;
};

export async function updateVoting(id: string, patch: VotingUpdate): Promise<void> {
  await sql`
    UPDATE votings SET
      name = COALESCE(${patch.name ?? null}, name),
      short_name = COALESCE(${patch.shortName ?? null}, short_name),
      description = COALESCE(${patch.description ?? null}, description),
      accent = COALESCE(${patch.accent ?? null}, accent),
      accent_dark = COALESCE(${patch.accentDark ?? null}, accent_dark),
      logo_url = COALESCE(${patch.logoUrl ?? null}, logo_url),
      active = COALESCE(${patch.active ?? null}, active),
      public_access = COALESCE(${patch.publicAccess ?? null}, public_access),
      voter_password_hash = COALESCE(${patch.voterPasswordHash ?? null}, voter_password_hash),
      updated_at = now()
    WHERE id = ${id};
  `;
}

export async function upsertRanking(input: {
  fullName: string;
  email: string;
  userId: string | null;
  voting: VotingId;
  positions: string[];
}): Promise<{ id: string }> {
  const positionsJson = JSON.stringify(input.positions);
  const result = await sql<{ id: string }>`
    INSERT INTO rankings (full_name, email, user_id, voting, positions)
    VALUES (${input.fullName}, ${input.email}, ${input.userId}, ${input.voting}, ${positionsJson}::jsonb)
    ON CONFLICT (email, voting)
    DO UPDATE SET
      full_name = EXCLUDED.full_name,
      user_id = COALESCE(EXCLUDED.user_id, rankings.user_id),
      positions = EXCLUDED.positions,
      updated_at = now()
    RETURNING id
  `;
  return { id: result.rows[0].id };
}

export async function getRankingById(id: string): Promise<RankingRow | null> {
  const result = await sql<RankingRow>`
    SELECT id, full_name, email, user_id, voting, positions, created_at, updated_at
    FROM rankings
    WHERE id = ${id}
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function getRankingsByVoting(voting: VotingId): Promise<RankingRow[]> {
  const result = await sql<RankingRow>`
    SELECT id, full_name, email, user_id, voting, positions, created_at, updated_at
    FROM rankings
    WHERE voting = ${voting}
    ORDER BY created_at ASC
  `;
  return result.rows;
}

export async function getRankingByUser(
  userId: string,
  voting: VotingId,
): Promise<RankingRow | null> {
  const result = await sql<RankingRow>`
    SELECT id, full_name, email, user_id, voting, positions, created_at, updated_at
    FROM rankings
    WHERE user_id = ${userId} AND voting = ${voting}
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

/* ── Usuarios ─────────────────────────────────────────────────────────── */

export async function createUser(input: {
  fullName: string;
  email: string;
  passwordHash: string;
}): Promise<UserRow> {
  const result = await sql<UserRow>`
    INSERT INTO users (full_name, email, password_hash)
    VALUES (${input.fullName}, ${input.email}, ${input.passwordHash})
    RETURNING id, full_name, email, password_hash, created_at, updated_at
  `;
  return result.rows[0];
}

export async function getUserByEmail(email: string): Promise<UserRow | null> {
  const result = await sql<UserRow>`
    SELECT id, full_name, email, password_hash, created_at, updated_at
    FROM users WHERE email = ${email} LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const result = await sql<UserRow>`
    SELECT id, full_name, email, password_hash, created_at, updated_at
    FROM users WHERE id = ${id} LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function updateUserName(id: string, fullName: string): Promise<void> {
  await sql`UPDATE users SET full_name = ${fullName}, updated_at = now() WHERE id = ${id};`;
  // El nombre viaja también al ranking vigente: es el que sale en la imagen.
  await sql`UPDATE rankings SET full_name = ${fullName} WHERE user_id = ${id};`;
}

export async function updateUserPassword(id: string, passwordHash: string): Promise<void> {
  await sql`
    UPDATE users SET password_hash = ${passwordHash}, updated_at = now() WHERE id = ${id};
  `;
}

/**
 * Enlaza con la cuenta recién creada los datos que ya existían con ese email:
 * el ranking suelto de la época sin cuentas y sus entradas en screenshots.
 */
export async function adoptDataByEmail(userId: string, email: string): Promise<void> {
  await sql`UPDATE rankings SET user_id = ${userId} WHERE email = ${email} AND user_id IS NULL;`;
  await sql`
    UPDATE snapshot_entries SET user_id = ${userId} WHERE email = ${email} AND user_id IS NULL;
  `;
}

export type UserListRow = UserPublic & {
  ranking_updated_at: string | null;
  snapshot_count: number;
};

export async function listUsers(voting: VotingId): Promise<UserListRow[]> {
  const result = await sql<UserListRow>`
    SELECT u.id, u.full_name, u.email, u.created_at, u.updated_at,
           r.updated_at AS ranking_updated_at,
           (SELECT COUNT(*)::int FROM snapshot_entries se WHERE se.user_id = u.id)
             AS snapshot_count
    FROM users u
    LEFT JOIN rankings r ON r.user_id = u.id AND r.voting = ${voting}
    ORDER BY u.full_name ASC
  `;
  return result.rows;
}

/* ── Screenshots (fotos congeladas) ───────────────────────────────────── */

export type SnapshotEntryInput = {
  userId: string | null;
  fullName: string;
  email: string;
  positions: string[];
};

export async function createSnapshot(input: {
  voting: VotingId;
  name: string;
  consensus: string[];
  entries: SnapshotEntryInput[];
}): Promise<{ id: string }> {
  const client = await db.connect();
  try {
    await client.sql`BEGIN`;
    const inserted = await client.sql<{ id: string }>`
      INSERT INTO snapshots (voting, name, consensus, entry_count)
      VALUES (
        ${input.voting}, ${input.name},
        ${JSON.stringify(input.consensus)}::jsonb, ${input.entries.length}
      )
      RETURNING id
    `;
    const snapshotId = inserted.rows[0].id;
    await client.sql`
      INSERT INTO snapshot_entries (snapshot_id, user_id, full_name, email, positions)
      SELECT ${snapshotId},
             NULLIF(e->>'userId', '')::uuid,
             e->>'fullName',
             e->>'email',
             e->'positions'
      FROM jsonb_array_elements(${JSON.stringify(input.entries)}::jsonb) AS e
    `;
    await client.sql`COMMIT`;
    return { id: snapshotId };
  } catch (err) {
    await client.sql`ROLLBACK`;
    throw err;
  } finally {
    client.release();
  }
}

// Más reciente primero.
export async function listSnapshots(voting: VotingId): Promise<SnapshotRow[]> {
  const result = await sql<SnapshotRow>`
    SELECT id, voting, name, consensus, entry_count, created_at
    FROM snapshots WHERE voting = ${voting}
    ORDER BY created_at DESC
  `;
  return result.rows;
}

export async function getSnapshotById(id: string): Promise<SnapshotRow | null> {
  const result = await sql<SnapshotRow>`
    SELECT id, voting, name, consensus, entry_count, created_at
    FROM snapshots WHERE id = ${id} LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function getLatestSnapshot(voting: VotingId): Promise<SnapshotRow | null> {
  const result = await sql<SnapshotRow>`
    SELECT id, voting, name, consensus, entry_count, created_at
    FROM snapshots WHERE voting = ${voting}
    ORDER BY created_at DESC LIMIT 1
  `;
  return result.rows[0] ?? null;
}

// Screenshot inmediatamente anterior a `createdAt`: la base con la que se
// comparan las flechas de evolución de un screenshot concreto.
export async function getPreviousSnapshot(
  voting: VotingId,
  createdAt: string,
): Promise<SnapshotRow | null> {
  const result = await sql<SnapshotRow>`
    SELECT id, voting, name, consensus, entry_count, created_at
    FROM snapshots
    WHERE voting = ${voting} AND created_at < ${createdAt}
    ORDER BY created_at DESC LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function getSnapshotEntries(snapshotId: string): Promise<SnapshotEntryRow[]> {
  const result = await sql<SnapshotEntryRow>`
    SELECT id, snapshot_id, user_id, full_name, email, positions, created_at
    FROM snapshot_entries WHERE snapshot_id = ${snapshotId}
    ORDER BY full_name ASC
  `;
  return result.rows;
}

export async function getSnapshotEntryById(id: string): Promise<SnapshotEntryRow | null> {
  const result = await sql<SnapshotEntryRow>`
    SELECT id, snapshot_id, user_id, full_name, email, positions, created_at
    FROM snapshot_entries WHERE id = ${id} LIMIT 1
  `;
  return result.rows[0] ?? null;
}

/**
 * Todas las entradas de un usuario, del screenshot más reciente al más
 * antiguo. Alimenta su histórico personal, su racha y la base de comparación
 * cuando no aparece en el último screenshot.
 */
export async function getSnapshotEntriesByUser(
  userId: string,
  voting: VotingId,
): Promise<Array<SnapshotEntryRow & { snapshot_name: string; snapshot_created_at: string }>> {
  const result = await sql<
    SnapshotEntryRow & { snapshot_name: string; snapshot_created_at: string }
  >`
    SELECT e.id, e.snapshot_id, e.user_id, e.full_name, e.email, e.positions, e.created_at,
           s.name AS snapshot_name, s.created_at AS snapshot_created_at
    FROM snapshot_entries e
    JOIN snapshots s ON s.id = e.snapshot_id
    WHERE e.user_id = ${userId} AND s.voting = ${voting}
    ORDER BY s.created_at DESC
  `;
  return result.rows;
}

/**
 * Última entrada congelada de un email, con el nombre del screenshot.
 * Por email (y no por usuario) para cubrir también los rankings antiguos que
 * todavía no ha adoptado ninguna cuenta.
 */
export async function getLatestSnapshotEntryByEmail(
  email: string,
  voting: VotingId,
): Promise<(SnapshotEntryRow & { snapshot_name: string }) | null> {
  const result = await sql<SnapshotEntryRow & { snapshot_name: string }>`
    SELECT e.id, e.snapshot_id, e.user_id, e.full_name, e.email, e.positions, e.created_at,
           s.name AS snapshot_name
    FROM snapshot_entries e
    JOIN snapshots s ON s.id = e.snapshot_id
    WHERE e.email = ${email} AND s.voting = ${voting}
    ORDER BY s.created_at DESC
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

/** Entrada del mismo email en el screenshot inmediatamente anterior a otro. */
export async function getPreviousSnapshotEntryByEmail(
  email: string,
  voting: VotingId,
  beforeCreatedAt: string,
): Promise<(SnapshotEntryRow & { snapshot_name: string }) | null> {
  const result = await sql<SnapshotEntryRow & { snapshot_name: string }>`
    SELECT e.id, e.snapshot_id, e.user_id, e.full_name, e.email, e.positions, e.created_at,
           s.name AS snapshot_name
    FROM snapshot_entries e
    JOIN snapshots s ON s.id = e.snapshot_id
    WHERE e.email = ${email} AND s.voting = ${voting} AND s.created_at < ${beforeCreatedAt}
    ORDER BY s.created_at DESC
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function renameSnapshot(id: string, name: string): Promise<void> {
  await sql`UPDATE snapshots SET name = ${name} WHERE id = ${id};`;
}

export async function deleteSnapshot(id: string): Promise<void> {
  await sql`DELETE FROM snapshots WHERE id = ${id};`;
}
