import { notFound, redirect } from "next/navigation";
import { getRankingsByVoting, getVotingBySlug } from "@/lib/db/client";
import { computeDeviationLeaveOneOut } from "@/lib/ranking-deviation";
import { isAdminAuthenticated } from "@/lib/auth";
import { hasVotingAdminAccess } from "@/lib/voting-access";
import { VoterRankingView } from "./VoterRankingView";

export const dynamic = "force-dynamic";

type Params = Promise<{ voting: string; voterId: string }>;

export default async function VoterRankingPage({
  params,
}: {
  params: Params;
}) {
  const { voting: slug, voterId } = await params;
  const voting = await getVotingBySlug(slug);
  if (!voting) notFound();

  const isSuper = await isAdminAuthenticated();
  const isVotingAdmin = await hasVotingAdminAccess(voting.id);
  if (!isSuper && !isVotingAdmin) {
    redirect(`/admin/${slug}/access`);
  }

  const rows = await getRankingsByVoting(voting.id);
  const voterRow = rows.find((r) => r.id === voterId);
  if (!voterRow) notFound();

  const deviation = computeDeviationLeaveOneOut(
    voterRow.positions,
    rows.filter((r) => r.id !== voterRow.id).map((r) => r.positions),
  );

  const { voter_password_hash: _v, admin_password_hash: _a, ...publicVoting } = voting;
  void _v;
  void _a;

  return (
    <VoterRankingView
      voting={publicVoting}
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
