import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  getLatestSnapshot,
  getRankingByUser,
  getRankingsByVoting,
  getVoting,
} from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user-auth";
import { isAdminAuthenticated } from "@/lib/auth";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import {
  computeDeviation,
  computeDeviationLeaveOneOut,
} from "@/lib/ranking-deviation";
import { computeEvolution } from "@/lib/ranking-evolution";
import { RankingComparison } from "@/components/RankingComparison";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

/**
 * Consensus en vivo: el ranking global calculado con los rankings guardados en
 * este momento (no el congelado de un screenshot), enfrentado al ranking del
 * usuario que lo mira.
 */
export default async function ConsensoPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const user = await getCurrentUser();
  if (!user && !(await isAdminAuthenticated())) redirect("/");

  const [rankings, latestSnapshot, myRanking] = await Promise.all([
    getRankingsByVoting(voting.id),
    getLatestSnapshot(voting.id),
    user ? getRankingByUser(user.id, voting.id) : Promise.resolve(null),
  ]);

  const consensus =
    rankings.length > 0 ? computeGlobalRanking(rankings.map((r) => r.positions)) : null;
  const consensusPositions = consensus?.ranking.map((e) => e.teamAbbr) ?? [];

  // Flechas del consensus en vivo respecto al último screenshot congelado.
  const deltaByTeam = new Map(
    computeEvolution(consensusPositions, latestSnapshot?.consensus ?? null).map((e) => [
      e.teamAbbr,
      e.delta,
    ]),
  );

  // Comparativa con el ranking del usuario contra el consensus que se está
  // pintando (con todos los votos incluidos, el suyo también), para que el
  // resto de la página (diffs, Clavados, Mayor distancia, over/underrated)
  // cuadre con las posiciones que ve en la lista de arriba.
  const deviation =
    consensus && myRanking ? computeDeviation(myRanking.positions, consensus.ranking) : null;

  // Solo la "Desviación media" se calcula "leave one out" (consensus sin su
  // propio voto), para evitar el sesgo de auto-comparación, igual que en el
  // panel de admin.
  const meanDeviationLeaveOneOut = myRanking
    ? computeDeviationLeaveOneOut(
        myRanking.positions,
        rankings.filter((r) => r.id !== myRanking.id).map((r) => r.positions),
      ).meanAbsDeviation
    : null;

  const lastUpdate = rankings.reduce<string | null>((acc, r) => {
    return !acc || new Date(r.updated_at) > new Date(acc) ? r.updated_at : acc;
  }, null);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Consensus en vivo
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">
            Power Ranking del momento
          </h1>
          <p className="mt-1 text-sm text-muted">
            {voting.name} · {rankings.length}{" "}
            {rankings.length === 1 ? "ranking" : "rankings"} contados
            {lastUpdate && ` · último voto ${dateFmt.format(new Date(lastUpdate))}`}
          </p>
        </div>
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Mi ranking
        </Link>
      </header>

      {consensus === null ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Todavía no hay ningún ranking guardado, así que aún no se puede calcular
          el consensus.
        </p>
      ) : (
        <>
          <p className="mb-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
            Este consensus se calcula ahora mismo con todos los rankings guardados
            (incluido el tuyo) y cambia según vota la gente. El de cada screenshot
            queda congelado en el{" "}
            <Link href="/historico" className="underline hover:text-foreground">
              histórico
            </Link>
            .
          </p>

          <RankingComparison
            positions={consensusPositions}
            reference={{
              title: "Consensus",
              name: "Consensus",
              de: "del consensus",
              a: "al consensus",
            }}
            deltaByTeam={deltaByTeam}
            since={latestSnapshot?.name ?? null}
            deviation={deviation}
            meanDeviation={meanDeviationLeaveOneOut}
            accent={voting.accent}
          />

          {user && !myRanking && (
            <p className="mt-4 rounded-xl border border-border bg-surface px-3 py-2 text-xs text-muted">
              Guarda tu ranking para comparar tu Power Ranking con el consensus.
            </p>
          )}
        </>
      )}

      <nav className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/vote"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Mi ranking
        </Link>
        <Link
          href="/historico"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Revisar Screenshots
        </Link>
        <Link
          href="/usuarios"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          Ver otros usuarios
        </Link>
      </nav>
    </main>
  );
}
