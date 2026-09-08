import { ImageResponse } from "next/og";
import { getSnapshotById, getSnapshotEntries, getVoting } from "@/lib/db/client";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSessionUserId } from "@/lib/user-auth";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { absoluteLogoUrl, getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";
import { RoundImage } from "@/lib/og/round-image";
import { ACCENT, IMAGE_SQUARE, dateFormatter } from "@/lib/og/theme";

export const runtime = "nodejs";

type Params = Promise<{ id: string; round: string }>;

/**
 * Una fase del algoritmo sobre el consensus congelado de un screenshot, en
 * cuadrado 1080×1080 (el mismo carrusel que exporta el admin del ranking en
 * vivo). Las fases no se guardan: se recalculan con las entradas congeladas
 * del screenshot, así que reproducen su consensus mientras el algoritmo no
 * cambie.
 */
export async function GET(req: Request, { params }: { params: Params }) {
  const allowed = (await getSessionUserId()) !== null || (await isAdminAuthenticated());
  if (!allowed) return new Response("Unauthorized", { status: 401 });

  const { id, round: roundParam } = await params;
  const snapshot = await getSnapshotById(id);
  if (!snapshot) return new Response("Not found", { status: 404 });

  const voting = await getVoting();
  if (!voting || voting.id !== snapshot.voting) {
    return new Response("Voting not found", { status: 404 });
  }

  const entryRows = await getSnapshotEntries(snapshot.id);
  if (entryRows.length === 0) return new Response("No submissions", { status: 404 });

  const result = computeGlobalRanking(entryRows.map((e) => e.positions));

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
          eyebrow={`Consensus · ${dateFormatter.format(new Date(snapshot.created_at))}`}
          title={snapshot.name}
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
        // El contenido de un screenshot ya no cambia (salvo renombrado).
        headers: { "Cache-Control": "private, max-age=3600" },
      },
    );
  } catch (err) {
    console.error("Failed to render snapshot round PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}
