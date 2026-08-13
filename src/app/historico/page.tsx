import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getSnapshotEntriesByUser,
  getVoting,
  listSnapshots,
} from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default async function HistoricoPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const user = await getCurrentUser();
  if (!user && !(await isAdminAuthenticated())) redirect("/");

  const [snapshots, myEntries] = await Promise.all([
    listSnapshots(voting.id),
    user ? getSnapshotEntriesByUser(user.id, voting.id) : Promise.resolve([]),
  ]);

  const myEntryBySnapshot = new Map(myEntries.map((e) => [e.snapshot_id, e.id]));

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
          <h1 className="font-display text-4xl uppercase leading-tight">Screenshots</h1>
          <p className="mt-1 text-sm text-muted">
            Cada screenshot congela el consensus de la comunidad y el ranking de
            quienes participaron.
          </p>
        </div>
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Mi ranking
        </Link>
      </header>

      {snapshots.length >= 2 && (
        <Link
          href={`/historico/comparar?a=${snapshots[1].id}&b=${snapshots[0].id}`}
          className="font-subhead mb-4 inline-block rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Comparar dos screenshots
        </Link>
      )}

      {snapshots.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Todavía no hay ningún screenshot. En cuanto se cree el primero, aquí
          verás la evolución semana a semana.
        </p>
      ) : (
        <ul className="space-y-3">
          {snapshots.map((snapshot) => {
            const myEntryId = myEntryBySnapshot.get(snapshot.id);
            return (
              <li
                key={snapshot.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <Link
                    href={`/historico/${snapshot.id}`}
                    className="font-display truncate text-2xl uppercase hover:underline"
                  >
                    {snapshot.name}
                  </Link>
                  <p className="text-xs text-muted">
                    {dateFmt.format(new Date(snapshot.created_at))} ·{" "}
                    {snapshot.entry_count} rankings
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/historico/${snapshot.id}`}
                    className="font-subhead rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground"
                  >
                    Consensus
                  </Link>
                  {myEntryId && (
                    <Link
                      href={`/historico/${snapshot.id}/${myEntryId}`}
                      className="font-subhead rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-[11px] uppercase tracking-wide transition hover:border-foreground"
                    >
                      Mi ranking
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
