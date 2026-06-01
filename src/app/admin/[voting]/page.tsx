import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getRankingsByVoting, getVotingBySlug } from "@/lib/db/client";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { computeDeviationLeaveOneOut } from "@/lib/ranking-deviation";
import { getAllQbs } from "@/data/qbs";
import { isAdminAuthenticated } from "@/lib/auth";
import { hasVotingAdminAccess } from "@/lib/voting-access";
import { AdminRankingView } from "./AdminRankingView";

export const dynamic = "force-dynamic";

type Params = Promise<{ voting: string }>;
type Search = Promise<{ mode?: string; round?: string }>;

export default async function AdminDashboardPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { voting: slug } = await params;
  const search = await searchParams;
  const voting = await getVotingBySlug(slug);
  if (!voting) notFound();

  const isSuper = await isAdminAuthenticated();
  const isVotingAdmin = await hasVotingAdminAccess(voting.id);
  if (!isSuper && !isVotingAdmin) {
    redirect(`/admin/${slug}/access`);
  }

  const rows = await getRankingsByVoting(voting.id);
  const result = computeGlobalRanking(rows.map((r) => r.positions));
  const qbCount = getAllQbs().length;

  const initialMode = search.mode === "stream" ? "stream" : "list";
  const initialRound = Math.max(
    0,
    Math.min(result.rounds.length - 1, parseInt(search.round ?? "0", 10) || 0),
  );

  const { voter_password_hash: _v, admin_password_hash: _a, ...publicVoting } = voting;
  void _v;
  void _a;

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Ranking global
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">{voting.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {result.totalSubmissions} envíos · {qbCount} QBs en 7 rondas
          </p>
        </div>
        {isSuper && (
          <Link
            href="/admin"
            className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
          >
            ← Volver al panel
          </Link>
        )}
      </header>

      {result.totalSubmissions === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted">
          Todavía no hay envíos en esta votación.
        </div>
      ) : (
        <AdminRankingView
          voting={publicVoting}
          result={result}
          initialMode={initialMode}
          initialRound={initialRound}
          voters={rows
            .map((r) => ({
              id: r.id,
              fullName: r.full_name,
              email: r.email,
              updatedAt: r.updated_at,
              meanDeviation: computeDeviationLeaveOneOut(
                r.positions,
                rows.filter((o) => o.id !== r.id).map((o) => o.positions),
              ).meanAbsDeviation,
            }))
            .sort((a, b) => a.meanDeviation - b.meanDeviation)
            .map((v, idx) => ({ ...v, rankPosition: idx + 1 }))}
        />
      )}
    </main>
  );
}
