import { ImageResponse } from "next/og";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getLatestSnapshot,
  getRankingsByVoting,
  getSnapshotById,
  getVoting,
} from "@/lib/db/client";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { computeEvolution } from "@/lib/ranking-evolution";
import { absoluteLogoUrl, getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";
import { RankingImage, buildImageRows } from "@/lib/og/ranking-image";
import { IMAGE_HEIGHT, IMAGE_WIDTH, dateFormatter } from "@/lib/og/theme";

export const runtime = "nodejs";

export async function GET(req: Request) {
  if (!(await isAdminAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const voting = await getVoting();
  if (!voting) return new Response("Voting not found", { status: 404 });

  const rows = await getRankingsByVoting(voting.id);
  if (rows.length === 0) return new Response("No submissions", { status: 404 });

  const { ranking } = computeGlobalRanking(rows.map((r) => r.positions));
  const positions = [...ranking]
    .sort((a, b) => a.finalPosition - b.finalPosition)
    .map((entry) => entry.teamAbbr);

  // Base de comparación: el último screenshot, o el que se pida por query
  // (?base=<id>) para publicar "vs Week 1" en vez de "vs la semana pasada".
  const baseId = new URL(req.url).searchParams.get("base");
  const base = baseId
    ? await getSnapshotById(baseId)
    : await getLatestSnapshot(voting.id);
  const usableBase = base && base.voting === voting.id ? base : null;

  const deltaByTeam = new Map<string, number | null>(
    computeEvolution(positions, usableBase?.consensus ?? null).map((e) => [
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
          eyebrow={`Ranking Global · ${dateFormatter.format(new Date())}`}
          titleLines={[voting.name]}
          rows={buildImageRows(positions, deltaByTeam)}
          footerLeft={usableBase ? `Evolución vs ${usableBase.name}` : "Consensus de la comunidad"}
          footerRight={voting.name}
          fonts={resolveFontNames(fonts)}
        />
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: { "Cache-Control": "private, max-age=60" },
      },
    );
  } catch (err) {
    console.error("Failed to render story PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}
