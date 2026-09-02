import { findTeamByAbbr, teamLogoUrl } from "@/data/teams";

export const runtime = "nodejs";

type Params = Promise<{ abbr: string }>;

/**
 * Proxy del escudo de un equipo desde nuestro propio origen.
 *
 * El vídeo se graba capturando un canvas, y un canvas con imágenes de otro
 * dominio queda "contaminado" y no se puede capturar. Solo se sirven los 32
 * `abbr` conocidos, así que no hay forma de pedir una URL arbitraria.
 */
export async function GET(_req: Request, { params }: { params: Params }) {
  const { abbr } = await params;
  const team = findTeamByAbbr(abbr.toUpperCase());
  if (!team) return new Response("Not found", { status: 404 });

  let upstream: Response;
  try {
    upstream = await fetch(teamLogoUrl(team.abbr), { cache: "force-cache" });
  } catch {
    return new Response("Upstream error", { status: 502 });
  }
  if (!upstream.ok) return new Response("Upstream error", { status: 502 });

  const contentType = upstream.headers.get("content-type") ?? "";
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": contentType.startsWith("image/") ? contentType : "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=31536000, immutable",
    },
  });
}
