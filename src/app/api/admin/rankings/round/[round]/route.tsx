import { ImageResponse } from "next/og";
import { getLatestSnapshot, getRankingsByVoting, getVoting } from "@/lib/db/client";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { rankingsUpdatedAfter, snapshotCutoff } from "@/lib/ranking-pool";
import { isAdminAuthenticated } from "@/lib/auth";
import { absoluteLogoUrl, getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";
import { RoundImage } from "@/lib/og/round-image";
import { ACCENT, IMAGE_SQUARE } from "@/lib/og/theme";

export const runtime = "nodejs";

type Params = Promise<{ round: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  const { round: roundParam } = await params;

  if (!(await isAdminAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const voting = await getVoting();
  if (!voting) return new Response("Not found", { status: 404 });

  const [rows, latest] = await Promise.all([
    getRankingsByVoting(voting.id),
    getLatestSnapshot(voting.id),
  ]);
  const included = rankingsUpdatedAfter(rows, snapshotCutoff(latest));
  if (included.length === 0) return new Response("No submissions", { status: 404 });

  const result = computeGlobalRanking(included.map((r) => r.positions));

  const roundIndex = parseInt(roundParam, 10);
  if (isNaN(roundIndex) || roundIndex < 0 || roundIndex >= result.rounds.length) {
    return new Response("Invalid round", { status: 400 });
  }

  const breakdown = result.rounds[roundIndex];

  // Equipos que cierran su puesto en esta fase; RoundImage los ordena.
  const entries = result.ranking.filter((e) => e.roundIndex === roundIndex);

  const origin = getOrigin(req);
  const fonts = await loadAllFonts();

  try {
    return new ImageResponse(
      (
        <RoundImage
          logoSrc={absoluteLogoUrl(voting.logo_url, origin)}
          eyebrow="Ranking Global · 2026"
          title={voting.name}
          roundIndex={roundIndex}
          totalRounds={result.rounds.length}
          positionsAssigned={breakdown.positionsAssigned}
          entries={entries}
          accent={voting.accent || ACCENT}
          footerRight={voting.name}
          fonts={resolveFontNames(fonts)}
        />
      ),
      {
        width: IMAGE_SQUARE,
        height: IMAGE_SQUARE,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: { "Cache-Control": "private, max-age=300" },
      },
    );
  } catch (err) {
    console.error("Failed to render PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}
