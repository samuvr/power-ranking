import { notFound, redirect } from "next/navigation";
import { RankingBoard } from "@/components/RankingBoard";
import { getVoting, toPublicVoting } from "@/lib/db/client";
import { hasVoterAccess } from "@/lib/voting-access";
import { isAdminAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const voting = await getVoting();
  if (!voting || !voting.active) notFound();

  const isAdmin = await isAdminAuthenticated();
  const isVoter = await hasVoterAccess(voting.id);
  if (!isAdmin && !isVoter) {
    redirect("/");
  }

  return <RankingBoard voting={toPublicVoting(voting)} />;
}
