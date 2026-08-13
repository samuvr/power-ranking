import { ImageResponse } from "next/og";
import {
  getPreviousSnapshotEntryByEmail,
  getSnapshotById,
  getSnapshotEntryById,
  getVoting,
} from "@/lib/db/client";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSessionUserId } from "@/lib/user-auth";
import { computeEvolution } from "@/lib/ranking-evolution";
import { absoluteLogoUrl, getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";
import { RankingImage, buildImageRows } from "@/lib/og/ranking-image";
import { IMAGE_HEIGHT, IMAGE_WIDTH, dateFormatter } from "@/lib/og/theme";

export const runtime = "nodejs";

type Params = Promise<{ id: string; entryId: string }>;

// Ranking individual congelado dentro de un screenshot.
export async function GET(req: Request, { params }: { params: Params }) {
  const allowed = (await getSessionUserId()) !== null || (await isAdminAuthenticated());
  if (!allowed) return new Response("Unauthorized", { status: 401 });

  const { id, entryId } = await params;
  const [snapshot, entry] = await Promise.all([
    getSnapshotById(id),
    getSnapshotEntryById(entryId),
  ]);
  if (!snapshot || !entry || entry.snapshot_id !== snapshot.id) {
    return new Response("Not found", { status: 404 });
  }

  const voting = await getVoting();
  if (!voting || voting.id !== snapshot.voting) {
    return new Response("Voting not found", { status: 404 });
  }

  // Se compara con la anterior aparición del mismo votante, que puede ser de
  // hace varios screenshots si se saltó alguno.
  const previous = await getPreviousSnapshotEntryByEmail(
    entry.email,
    snapshot.voting,
    snapshot.created_at,
  );
  const deltaByTeam = new Map<string, number | null>(
    computeEvolution(entry.positions, previous?.positions ?? null).map((e) => [
      e.teamAbbr,
      e.delta,
    ]),
  );

  const origin = getOrigin(req);
  const fonts = await loadAllFonts();

  try {
    return new ImageResponse(
      (
        <RankingImage
          logoSrc={absoluteLogoUrl(voting.logo_url, origin)}
          eyebrow={`${snapshot.name} · ${dateFormatter.format(new Date(snapshot.created_at))}`}
          titleLines={["Ranking de", entry.full_name]}
          rows={buildImageRows(entry.positions, deltaByTeam)}
          footerLeft={previous ? `Evolución vs ${previous.snapshot_name}` : "Primera participación"}
          footerRight={voting.name}
          fonts={resolveFontNames(fonts)}
        />
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: { "Cache-Control": "private, max-age=3600" },
      },
    );
  } catch (err) {
    console.error("Failed to render snapshot entry PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}
