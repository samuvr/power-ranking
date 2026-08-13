import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getVoting, listUsers } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/** Listado de usuarios registrados para cotillear el ranking de cualquiera. */
export default async function UsuariosPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const user = await getCurrentUser();
  if (!user && !(await isAdminAuthenticated())) redirect("/");

  const users = await listUsers(voting.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            {voting.name}
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">Otros usuarios</h1>
          <p className="mt-1 text-sm text-muted">
            Elige a cualquiera para ver su último Power Ranking guardado y el que
            dejó en cada screenshot.
          </p>
        </div>
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Mi ranking
        </Link>
      </header>

      {users.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Todavía no hay ninguna cuenta registrada.
        </p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
            >
              <div className="min-w-0">
                <Link
                  href={`/usuarios/${u.id}`}
                  className="font-display truncate text-2xl uppercase hover:underline"
                >
                  {u.full_name}
                  {user?.id === u.id && (
                    <span className="font-subhead ml-2 align-middle text-[11px] normal-case tracking-wide text-muted">
                      (tú)
                    </span>
                  )}
                </Link>
                <p className="text-xs text-muted">
                  {u.ranking_updated_at
                    ? `Ranking guardado el ${dateFmt.format(new Date(u.ranking_updated_at))}`
                    : "Todavía sin ranking guardado"}
                  {` · ${u.snapshot_count} ${
                    u.snapshot_count === 1 ? "screenshot" : "screenshots"
                  }`}
                </p>
              </div>
              <Link
                href={`/usuarios/${u.id}`}
                className="font-subhead rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground"
              >
                Ver ranking
              </Link>
            </li>
          ))}
        </ul>
      )}

      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Mi ranking
        </Link>
        <Link
          href="/consenso"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Ver Consensus
        </Link>
      </nav>
    </main>
  );
}
