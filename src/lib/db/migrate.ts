import { randomBytes } from "node:crypto";
import { sql } from "@vercel/postgres";
import bcrypt from "bcryptjs";

// La app solo tiene una votación: NFL Alicante.
const VOTING_ID = "11111111-1111-1111-1111-111111111111";
const VOTING_SLUG = "nfl-alicante";
const LEGACY_VOTING_TYPE = "nfl_alicante";

const SEED = {
  id: VOTING_ID,
  slug: VOTING_SLUG,
  name: "NFL Alicante",
  shortName: "NFLA",
  description: "Comunidad NFL de Alicante",
  accent: "#D81E2C",
  accentDark: "#8C0F1A",
  logoUrl: "/nfl-alicante.jpg",
};

// `npm run db:migrate -- --purge-extra-votings` borra las votaciones sobrantes
// junto con sus rankings. Sin el flag solo se borran las que no tienen votos.
const PURGE_EXTRA = process.argv.includes("--purge-extra-votings");

async function ensureVotingsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS votings (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      slug                  TEXT UNIQUE NOT NULL,
      name                  TEXT NOT NULL,
      short_name            TEXT NOT NULL,
      description           TEXT NOT NULL,
      accent                TEXT NOT NULL,
      accent_dark           TEXT NOT NULL,
      logo_url              TEXT NOT NULL,
      voter_password_hash   TEXT NOT NULL,
      active                BOOLEAN NOT NULL DEFAULT TRUE,
      public_access         BOOLEAN NOT NULL DEFAULT FALSE,
      created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  // Migraciones idempotentes sobre tablas ya existentes.
  await sql`
    ALTER TABLE votings ADD COLUMN IF NOT EXISTS
      public_access BOOLEAN NOT NULL DEFAULT FALSE;
  `;
  // Al existir una sola votación ya no hay ni orden ni admin por votación:
  // el panel se protege solo con ADMIN_PASSWORD.
  await sql`ALTER TABLE votings DROP COLUMN IF EXISTS position;`;
  await sql`ALTER TABLE votings DROP COLUMN IF EXISTS admin_password_hash;`;
  await sql`DROP INDEX IF EXISTS votings_position_idx;`;
}

async function ensureRankingsTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS rankings (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name   TEXT NOT NULL,
      email       TEXT NOT NULL,
      voting      UUID NOT NULL REFERENCES votings(id) ON DELETE RESTRICT,
      positions   JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (email, voting)
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS rankings_voting_idx ON rankings (voting);`;
}

async function ensureUsersTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name     TEXT NOT NULL,
      email         TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
}

// Cada ranking pasa a pertenecer a una cuenta. Se deja NULL en los rankings
// heredados de la época sin cuentas: los adopta el registro con ese email.
async function ensureRankingsUserColumn() {
  await sql`ALTER TABLE rankings ADD COLUMN IF NOT EXISTS user_id UUID;`;
  await sql`
    UPDATE rankings r SET user_id = u.id
    FROM users u WHERE u.email = r.email AND r.user_id IS NULL;
  `;
  await sql`
    DO $$ BEGIN
      ALTER TABLE rankings ADD CONSTRAINT rankings_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;
  `;
  await sql`CREATE INDEX IF NOT EXISTS rankings_user_idx ON rankings (user_id);`;
}

async function ensureSnapshotTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      voting      UUID NOT NULL REFERENCES votings(id) ON DELETE RESTRICT,
      name        TEXT NOT NULL,
      consensus   JSONB NOT NULL,
      entry_count INTEGER NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (voting, name)
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS snapshots_voting_idx ON snapshots (voting, created_at DESC);`;
  await sql`
    CREATE TABLE IF NOT EXISTS snapshot_entries (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      snapshot_id UUID NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
      user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
      full_name   TEXT NOT NULL,
      email       TEXT NOT NULL,
      positions   JSONB NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS snapshot_entries_snapshot_idx
      ON snapshot_entries (snapshot_id);
  `;
  await sql`
    CREATE INDEX IF NOT EXISTS snapshot_entries_user_idx ON snapshot_entries (user_id);
  `;
}

async function rankingsTableExists(): Promise<boolean> {
  const r = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'rankings'
    ) AS exists;
  `;
  return r.rows[0].exists;
}

async function rankingsVotingType(): Promise<string | null> {
  const r = await sql<{ data_type: string; udt_name: string }>`
    SELECT data_type, udt_name FROM information_schema.columns
    WHERE table_name = 'rankings' AND column_name = 'voting';
  `;
  const row = r.rows[0];
  if (!row) return null;
  return row.data_type === "USER-DEFINED" ? row.udt_name : row.data_type;
}

// Crea la votación si no existe todavía. Devuelve la contraseña generada
// (solo cuando se ha creado la fila) para que se pueda cambiar después.
async function seedVoting(): Promise<string | null> {
  const existing = await sql<{ count: string }>`
    SELECT COUNT(*)::text AS count FROM votings WHERE id = ${SEED.id} OR slug = ${SEED.slug};
  `;
  if (existing.rows[0].count !== "0") return null;

  const voterPwd = randomBytes(6).toString("hex");
  const voterHash = await bcrypt.hash(voterPwd, 10);
  await sql`
    INSERT INTO votings
      (id, slug, name, short_name, description, accent, accent_dark, logo_url,
       voter_password_hash, active)
    VALUES
      (${SEED.id}, ${SEED.slug}, ${SEED.name}, ${SEED.shortName}, ${SEED.description},
       ${SEED.accent}, ${SEED.accentDark}, ${SEED.logoUrl}, ${voterHash}, TRUE)
    ON CONFLICT (id) DO NOTHING;
  `;
  return voterPwd;
}

// Votación que conserva la app: la del slug canónico y, si no existe, la más
// antigua. Mismo criterio que `getVoting()` en el cliente de BD.
async function getKeeperVotingId(): Promise<string | null> {
  const r = await sql<{ id: string }>`
    SELECT id FROM votings
    ORDER BY CASE WHEN slug = ${SEED.slug} THEN 0 ELSE 1 END, created_at ASC
    LIMIT 1;
  `;
  return r.rows[0]?.id ?? null;
}

// Deja una única votación en la tabla. Las sobrantes sin rankings se borran
// siempre; las que tienen votos solo con --purge-extra-votings.
async function removeExtraVotings(keeperId: string) {
  const extras = await sql<{ id: string; name: string; rankings: string }>`
    SELECT v.id, v.name, COUNT(r.id)::text AS rankings
    FROM votings v
    LEFT JOIN rankings r ON r.voting = v.id
    WHERE v.id <> ${keeperId}
    GROUP BY v.id, v.name;
  `;

  for (const extra of extras.rows) {
    const rankings = parseInt(extra.rankings, 10);
    if (rankings > 0 && !PURGE_EXTRA) {
      console.log(
        `⚠️  La votación "${extra.name}" tiene ${rankings} rankings y no se ha borrado.\n` +
          "    Ejecuta `npm run db:migrate -- --purge-extra-votings` para eliminarla con sus votos.",
      );
      continue;
    }
    await sql`DELETE FROM rankings WHERE voting = ${extra.id};`;
    await sql`DELETE FROM votings WHERE id = ${extra.id};`;
    console.log(`Votación sobrante eliminada: ${extra.name} (${rankings} rankings).`);
  }
}

async function migrateLegacyRankings() {
  console.log("Migrating legacy rankings.voting (voting_type) → UUID FK…");
  await sql`ALTER TABLE rankings DROP CONSTRAINT IF EXISTS rankings_email_voting_key;`;
  await sql`DROP INDEX IF EXISTS rankings_voting_idx;`;
  await sql`ALTER TABLE rankings ADD COLUMN IF NOT EXISTS voting_id UUID;`;
  await sql`
    UPDATE rankings SET voting_id = ${SEED.id}
    WHERE voting_id IS NULL AND voting::text = ${LEGACY_VOTING_TYPE};
  `;
  // Los votos de votaciones que ya no existen se descartan.
  await sql`DELETE FROM rankings WHERE voting_id IS NULL;`;
  await sql`ALTER TABLE rankings ALTER COLUMN voting_id SET NOT NULL;`;
  await sql`
    ALTER TABLE rankings
      ADD CONSTRAINT rankings_voting_id_fkey
      FOREIGN KEY (voting_id) REFERENCES votings(id) ON DELETE RESTRICT;
  `;
  await sql`ALTER TABLE rankings DROP COLUMN voting;`;
  await sql`ALTER TABLE rankings RENAME COLUMN voting_id TO voting;`;
  await sql`ALTER TABLE rankings ADD CONSTRAINT rankings_email_voting_key UNIQUE (email, voting);`;
  await sql`CREATE INDEX IF NOT EXISTS rankings_voting_idx ON rankings (voting);`;
  await sql`DROP TYPE IF EXISTS voting_type;`;
}

async function migrate() {
  console.log("Running migrations…");

  const hadRankings = await rankingsTableExists();
  const legacyVoting = hadRankings ? await rankingsVotingType() : null;
  const isLegacy = legacyVoting === "voting_type";

  await ensureVotingsTable();
  const generatedPassword = await seedVoting();

  if (!hadRankings) {
    await ensureRankingsTable();
  } else if (isLegacy) {
    await migrateLegacyRankings();
  }

  await ensureUsersTable();
  await ensureRankingsUserColumn();
  await ensureSnapshotTables();

  const keeperId = await getKeeperVotingId();
  if (keeperId) await removeExtraVotings(keeperId);

  console.log("Migrations complete.");
  if (generatedPassword) {
    console.log(
      `\n⚠️  Votación "${SEED.name}" creada con contraseña de votante provisional: ${generatedPassword}` +
        "\n    Cámbiala en /admin/ajustes.",
    );
  }
}

migrate()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
