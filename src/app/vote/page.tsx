import { notFound, redirect } from "next/navigation";
import { RankingBoard } from "@/components/RankingBoard";
import {
  getLatestSnapshot,
  getRankingByUser,
  getSnapshotEntriesByUser,
  getVoting,
  toPublicVoting,
} from "@/lib/db/client";
import { TOTAL_TEAMS } from "@/data/teams";
import { getCurrentUser } from "@/lib/user-auth";

export const dynamic = "force-dynamic";

export default async function VotePage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const user = await getCurrentUser();
  if (!user) redirect("/");

  const [ranking, entries, latestSnapshot] = await Promise.all([
    getRankingByUser(user.id, voting.id),
    getSnapshotEntriesByUser(user.id, voting.id),
    getLatestSnapshot(voting.id),
  ]);

  // Base de comparación: el screenshot más reciente en el que aparece este
  // usuario, que no tiene por qué ser el último de la votación.
  const lastEntry = entries[0] ?? null;

  // "No has tocado tu ranking desde el último screenshot": el aviso que
  // empuja a actualizar antes de la siguiente foto.
  const savedAtMs = ranking ? new Date(ranking.updated_at).getTime() : null;
  const stale =
    latestSnapshot && savedAtMs !== null
      ? savedAtMs <= new Date(latestSnapshot.created_at).getTime()
      : false;

  return (
    <RankingBoard
      voting={toPublicVoting(voting)}
      user={{ id: user.id, fullName: user.full_name }}
      initialPositions={
        ranking?.positions ?? Array.from({ length: TOTAL_TEAMS }, () => null)
      }
      savedAt={ranking ? new Date(ranking.updated_at).toISOString() : null}
      previousPositions={lastEntry?.positions ?? null}
      previousLabel={lastEntry?.snapshot_name ?? null}
      staleSince={stale && latestSnapshot ? latestSnapshot.name : null}
      votingActive={voting.active}
    />
  );
}
