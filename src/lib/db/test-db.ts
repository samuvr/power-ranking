/**
 * Postgres de verdad, dentro del propio proceso de test.
 *
 * `@vercel/postgres` habla con Neon por WebSocket, así que no se puede apuntar
 * a un Postgres local sin levantar un proxy. En su lugar los tests sustituyen
 * el módulo entero (`vi.mock("@vercel/postgres")`) por este adaptador, que
 * traduce la plantilla etiquetada `sql` a consultas de PGlite —Postgres
 * compilado a WebAssembly—. Es Postgres real: los `DO $$ … $$`, los `JSONB`,
 * `gen_random_uuid()` y los códigos de error (42703 y compañía) se comportan
 * igual que en producción.
 *
 * Este fichero es solo para tests; nada de `src/app` lo importa, así que no
 * entra en el bundle de la aplicación.
 */
import { PGlite } from "@electric-sql/pglite";

export type QueryResult<T> = { rows: T[] };

let pending: Promise<PGlite> | null = null;

function instance(): Promise<PGlite> {
  if (!pending) pending = PGlite.create();
  return pending;
}

/**
 * Deja la base de datos como recién creada. Para el `beforeEach` de los tests.
 *
 * Vacía el esquema en vez de levantar otro PGlite: arrancar la instancia
 * cuesta un par de segundos y hacerlo una vez por test disparaba la suite.
 * `DROP SCHEMA public CASCADE` se lleva por delante tablas, índices y tipos
 * —incluido el enum `voting_type` de la época anterior—, que es justo lo que
 * distingue una base de datos virgen.
 */
export async function resetTestDb(): Promise<void> {
  const pg = await instance();
  await pg.exec("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
}

/** Cierra la base de datos: para el `afterAll`, y así el proceso no se queda. */
export async function closeTestDb(): Promise<void> {
  if (!pending) return;
  const current = await pending;
  pending = null;
  await current.close();
}

// `sql\`SELECT … ${x}\`` → ("SELECT … $1", [x]), que es lo que espera PGlite.
function toParameterized(
  strings: TemplateStringsArray,
  values: unknown[],
): { text: string; params: unknown[] } {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}${strings[i + 1]}`;
  }
  return { text, params: values };
}

async function run<T>(
  strings: TemplateStringsArray,
  values: unknown[],
): Promise<QueryResult<T>> {
  const { text, params } = toParameterized(strings, values);
  const pg = await instance();
  const result = await pg.query<T>(text, params);
  return { rows: result.rows };
}

/** Sustituto de `sql` de `@vercel/postgres`. */
export function sql<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<QueryResult<T>> {
  return run<T>(strings, values);
}

/**
 * Sustituto de `db` de `@vercel/postgres`. PGlite es una única conexión, así
 * que `BEGIN` / `COMMIT` funcionan sobre la misma sesión y `release()` no
 * tiene nada que soltar.
 */
export const db = {
  connect: async () => ({
    sql,
    release: () => {},
  }),
};
