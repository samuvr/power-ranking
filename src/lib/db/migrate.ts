// Punto de entrada por CLI: `npm run db:migrate`. La migración en sí vive en
// `migrations.ts`, que también usa /api/admin/migrate.
import { runMigrations } from "./migrations";

// `npm run db:migrate -- --purge-extra-votings` borra las votaciones sobrantes
// junto con sus rankings. Sin el flag solo se borran las que no tienen votos.
const purgeExtraVotings = process.argv.includes("--purge-extra-votings");

runMigrations({ purgeExtraVotings })
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
