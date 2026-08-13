import { sql } from "@vercel/postgres";

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
  voting: VotingId;
  positions: string[];
  created_at: string;
  updated_at: string;
};

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
  voting: VotingId;
  positions: string[];
}): Promise<{ id: string }> {
  const positionsJson = JSON.stringify(input.positions);
  const result = await sql<{ id: string }>`
    INSERT INTO rankings (full_name, email, voting, positions)
    VALUES (${input.fullName}, ${input.email}, ${input.voting}, ${positionsJson}::jsonb)
    ON CONFLICT (email, voting)
    DO UPDATE SET
      full_name = EXCLUDED.full_name,
      positions = EXCLUDED.positions,
      updated_at = now()
    RETURNING id
  `;
  return { id: result.rows[0].id };
}

export async function getRankingById(id: string): Promise<RankingRow | null> {
  const result = await sql<RankingRow>`
    SELECT id, full_name, email, voting, positions, created_at, updated_at
    FROM rankings
    WHERE id = ${id}
    LIMIT 1
  `;
  return result.rows[0] ?? null;
}

export async function getRankingsByVoting(voting: VotingId): Promise<RankingRow[]> {
  const result = await sql<RankingRow>`
    SELECT id, full_name, email, voting, positions, created_at, updated_at
    FROM rankings
    WHERE voting = ${voting}
    ORDER BY created_at ASC
  `;
  return result.rows;
}
