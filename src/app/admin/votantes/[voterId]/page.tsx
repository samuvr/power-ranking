import { notFound } from "next/navigation";
import { getRankingsByVoting, getVoting, toPublicVoting } from "@/lib/db/client";
import { computeDeviationLeaveOneOut } from "@/lib/ranking-deviation";
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

  return (
    <VoterRankingView
      voting={toPublicVoting(voting)}
      voter={{
        id: voterRow.id,
        fullName: voterRow.full_name,
        email: voterRow.email,
        positions: voterRow.positions,
        updatedAt: voterRow.updated_at,
      }}
      deviation={deviation}
    />
  );
}
