import { sql } from "@vercel/postgres";

export type VotingId = string;

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
  admin_password_hash: string;
  position: number;
  active: boolean;
  public_access: boolean;
  created_at: string;
  updated_at: string;
};

export type VotingPublic = Omit<VotingRow, "voter_password_hash" | "admin_password_hash">;

export type RankingRow = {
  id: string;
  full_name: string;
  email: string;
  voting: VotingId;
  positions: string[];
  created_at: string;
  updated_at: string;
};

function stripSecrets(row: VotingRow): VotingPublic {
  const { voter_password_hash: _v, admin_password_hash: _a, ...rest } = row;
  void _v;
  void _a;
  return rest;
}

export async function getActiveVotings(): Promise<VotingPublic[]> {
  const r = await sql<VotingRow>`
    SELECT id, slug, name, short_name, description, accent, accent_dark, logo_url,
           voter_password_hash, admin_password_hash, position, active, public_access, created_at, updated_at
    FROM votings WHERE active = TRUE ORDER BY position ASC, created_at ASC;
  `;
  return r.rows.map(stripSecrets);
}

export async function getAllVotingsForAdmin(): Promise<VotingPublic[]> {
  const r = await sql<VotingRow>`
    SELECT id, slug, name, short_name, description, accent, accent_dark, logo_url,
           voter_password_hash, admin_password_hash, position, active, public_access, created_at, updated_at
    FROM votings
    ORDER BY position ASC, created_at ASC;
  `;
  return r.rows.map(stripSecrets);
}

export async function getVotingBySlug(slug: string): Promise<VotingRow | null> {
  const r = await sql<VotingRow>`
    SELECT id, slug, name, short_name, description, accent, accent_dark, logo_url,
           voter_password_hash, admin_password_hash, position, active, public_access, created_at, updated_at
    FROM votings WHERE slug = ${slug} LIMIT 1;
  `;
  return r.rows[0] ?? null;
}

export async function getVotingById(id: string): Promise<VotingRow | null> {
  const r = await sql<VotingRow>`
    SELECT id, slug, name, short_name, description, accent, accent_dark, logo_url,
           voter_password_hash, admin_password_hash, position, active, public_access, created_at, updated_at
    FROM votings WHERE id = ${id} LIMIT 1;
  `;
  return r.rows[0] ?? null;
}

export async function createVoting(input: {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  accent: string;
  accentDark: string;
  logoUrl: string;
  voterPasswordHash: string;
  adminPasswordHash: string;
  publicAccess?: boolean;
}): Promise<{ id: string }> {
  const publicAccess = input.publicAccess ?? false;
  const r = await sql<{ id: string; nextpos: number }>`
    WITH next AS (SELECT COALESCE(MAX(position), -1) + 1 AS nextpos FROM votings)
    INSERT INTO votings
      (slug, name, short_name, description, accent, accent_dark, logo_url,
       voter_password_hash, admin_password_hash, position, active, public_access)
    SELECT ${input.slug}, ${input.name}, ${input.shortName}, ${input.description},
           ${input.accent}, ${input.accentDark}, ${input.logoUrl},
           ${input.voterPasswordHash}, ${input.adminPasswordHash},
           next.nextpos, TRUE, ${publicAccess}
    FROM next
    RETURNING id, position AS nextpos;
  `;
  return { id: r.rows[0].id };
}

export type VotingUpdate = {
  slug?: string;
  name?: string;
  shortName?: string;
  description?: string;
  accent?: string;
  accentDark?: string;
  logoUrl?: string;
  active?: boolean;
  publicAccess?: boolean;
  voterPasswordHash?: string;
  adminPasswordHash?: string;
};

export async function updateVoting(id: string, patch: VotingUpdate): Promise<void> {
  await sql`
    UPDATE votings SET
      slug = COALESCE(${patch.slug ?? null}, slug),
      name = COALESCE(${patch.name ?? null}, name),
      short_name = COALESCE(${patch.shortName ?? null}, short_name),
      description = COALESCE(${patch.description ?? null}, description),
      accent = COALESCE(${patch.accent ?? null}, accent),
      accent_dark = COALESCE(${patch.accentDark ?? null}, accent_dark),
      logo_url = COALESCE(${patch.logoUrl ?? null}, logo_url),
      active = COALESCE(${patch.active ?? null}, active),
      public_access = COALESCE(${patch.publicAccess ?? null}, public_access),
      voter_password_hash = COALESCE(${patch.voterPasswordHash ?? null}, voter_password_hash),
      admin_password_hash = COALESCE(${patch.adminPasswordHash ?? null}, admin_password_hash),
      updated_at = now()
    WHERE id = ${id};
  `;
}

export async function reorderVotings(orderedIds: string[]): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    await sql`UPDATE votings SET position = ${i}, updated_at = now() WHERE id = ${orderedIds[i]};`;
  }
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

// Copia los rankings de una votación origen a otra destino. Aprovecha la
// constraint UNIQUE (email, voting): los emails que ya tienen ranking en la
// votación destino se saltan (ON CONFLICT DO NOTHING), sin sobrescribirse.
export async function copyRankingsBetweenVotings(
  sourceVoting: VotingId,
  targetVoting: VotingId,
): Promise<{ copied: number; total: number; skipped: number }> {
  const total = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count FROM rankings WHERE voting = ${sourceVoting}
  `;
  const inserted = await sql`
    INSERT INTO rankings (full_name, email, voting, positions)
    SELECT full_name, email, ${targetVoting}, positions
    FROM rankings
    WHERE voting = ${sourceVoting}
    ON CONFLICT (email, voting) DO NOTHING
    RETURNING id
  `;
  const totalN = parseInt(total.rows[0].count, 10);
  const copied = inserted.rowCount ?? 0;
  return { copied, total: totalN, skipped: totalN - copied };
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

export async function getRankingsCountByVoting(): Promise<Record<string, number>> {
  const r = await sql<{ voting: string; count: string }>`
    SELECT voting::text AS voting, COUNT(*)::text AS count
    FROM rankings GROUP BY voting;
  `;
  const out: Record<string, number> = {};
  for (const row of r.rows) out[row.voting] = parseInt(row.count, 10);
  return out;
}
