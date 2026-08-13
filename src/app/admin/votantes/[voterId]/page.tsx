import { notFound } from "next/navigation";
import {
  getLatestSnapshotEntryByEmail,
  getRankingsByVoting,
  getVoting,
  toPublicVoting,
} from "@/lib/db/client";
import { computeDeviationLeaveOneOut } from "@/lib/ranking-deviation";
import { computeEvolution } from "@/lib/ranking-evolution";
import { VoterRankingView } from "./VoterRankingView";

export const dynamic = "force-dynamic";

type Params = Promise<{ voterId: string }>;

export default async function VoterRankingPage({
  params,
}: {
  params: Params;
}) {
  const { voterId } = await params;
  const voting = await getVoting();
  if (!voting) notFound();

  const rows = await getRankingsByVoting(voting.id);
  const voterRow = rows.find((r) => r.id === voterId);
  if (!voterRow) notFound();

  const deviation = computeDeviationLeaveOneOut(
    voterRow.positions,
    rows.filter((r) => r.id !== voterRow.id).map((r) => r.positions),
  );

  // Evolución respecto a la última foto en la que aparece este votante.
  const previous = await getLatestSnapshotEntryByEmail(voterRow.email, voting.id);
  const deltas: Record<string, number | null> = {};
  for (const evolution of computeEvolution(
    voterRow.positions,
    previous?.positions ?? null,
  )) {
    deltas[evolution.teamAbbr] = evolution.delta;
  }

  return (
    <VoterRankingView
      voting={toPublicVoting(voting)}
      voter={{
        id: voterRow.id,
        fullName: voterRow.full_name,
        email: voterRow.email,
        positions: voterRow.positions,
        updatedAt: new Date(voterRow.updated_at).toISOString(),
      }}
      deviation={deviation}
      deltas={deltas}
      since={previous?.snapshot_name ?? null}
      baseSnapshotId={previous?.snapshot_id ?? null}
    />
  );
}
