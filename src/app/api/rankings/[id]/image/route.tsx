import { ImageResponse } from "next/og";
import {
  getLatestSnapshotEntryByEmail,
  getRankingById,
  getVoting,
} from "@/lib/db/client";
import { computeEvolution } from "@/lib/ranking-evolution";
import { absoluteLogoUrl, getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";
import { RankingImage, buildImageRows } from "@/lib/og/ranking-image";
import { IMAGE_HEIGHT, IMAGE_WIDTH } from "@/lib/og/theme";

export const runtime = "nodejs";

type Params = Promise<{ id: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const ranking = await getRankingById(id);
  if (!ranking) {
    return new Response("Not found", { status: 404 });
  }

  const meta = await getVoting();
  if (!meta) {
    return new Response("Voting not found", { status: 404 });
  }

  // Evolución respecto al último screenshot en el que aparece este votante.
  const previous = await getLatestSnapshotEntryByEmail(ranking.email, ranking.voting);
  const deltaByTeam = new Map<string, number | null>(
    computeEvolution(ranking.positions, previous?.positions ?? null).map((e) => [
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
          logoSrc={absoluteLogoUrl(meta.logo_url, origin)}
          eyebrow={`${meta.name} · 2026`}
          titleLines={["Ranking de", ranking.full_name]}
          rows={buildImageRows(ranking.positions, deltaByTeam)}
          footerLeft={previous ? `Evolución vs ${previous.snapshot_name}` : "Haz tu propio top 32"}
          footerRight={meta.name}
          fonts={resolveFontNames(fonts)}
        />
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      },
    );
  } catch (err) {
    console.error("Failed to render PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}
