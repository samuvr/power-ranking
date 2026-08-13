import { ImageResponse } from "next/og";
import {
  getPreviousSnapshot,
  getSnapshotById,
  getVoting,
} from "@/lib/db/client";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSessionUserId } from "@/lib/user-auth";
import { computeEvolution } from "@/lib/ranking-evolution";
import { absoluteLogoUrl, getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";
import { RankingImage, buildImageRows } from "@/lib/og/ranking-image";
import { IMAGE_HEIGHT, IMAGE_WIDTH, dateFormatter } from "@/lib/og/theme";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

// Consensus congelado de un screenshot, con la evolución respecto al anterior.
export async function GET(req: Request, { params }: { params: Params }) {
  const allowed = (await getSessionUserId()) !== null || (await isAdminAuthenticated());
  if (!allowed) return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const snapshot = await getSnapshotById(id);
  if (!snapshot) return new Response("Not found", { status: 404 });

  const voting = await getVoting();
  if (!voting || voting.id !== snapshot.voting) {
    return new Response("Voting not found", { status: 404 });
  }

  const previous = await getPreviousSnapshot(snapshot.voting, snapshot.created_at);
  const deltaByTeam = new Map<string, number | null>(
    computeEvolution(snapshot.consensus, previous?.consensus ?? null).map((e) => [
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
          eyebrow={`Consensus · ${dateFormatter.format(new Date(snapshot.created_at))}`}
          titleLines={[snapshot.name]}
          rows={buildImageRows(snapshot.consensus, deltaByTeam)}
          footerLeft={previous ? `Evolución vs ${previous.name}` : "Primer screenshot"}
          footerRight={voting.name}
          fonts={resolveFontNames(fonts)}
        />
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        fonts: fonts.length > 0 ? fonts : undefined,
        // El contenido de un screenshot ya no cambia (salvo renombrado).
        headers: { "Cache-Control": "private, max-age=3600" },
      },
    );
  } catch (err) {
    console.error("Failed to render snapshot PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}
