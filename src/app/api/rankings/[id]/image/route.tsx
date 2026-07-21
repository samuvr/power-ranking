import { ImageResponse } from "next/og";
import { getRankingById, getVotingById } from "@/lib/db/client";
import { findTeamByAbbr, teamLogoUrl } from "@/data/teams";

export const runtime = "nodejs";

const WIDTH = 1080;
const HEIGHT = 1920;

// NFL Alicante palette
const BG = "#F4EEDC";
const FG = "#0A2240";
const ACCENT = "#C8102E";
const SURFACE = "#FBF7E8";
const BORDER = "rgba(10, 34, 64, 0.18)";
const MUTED = "rgba(10, 34, 64, 0.6)";

type Params = Promise<{ id: string }>;

/**
 * Descarga una Google Font como TTF. Usamos User-Agent IE6 para forzar TTF
 * (Satori no soporta WOFF2). Cacheado en build.
 */
async function loadGoogleFont(
  family: string,
  weight = 400,
): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const cssRes = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)" },
      cache: "force-cache",
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1], { cache: "force-cache" });
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

type FontEntry = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

async function loadAllFonts(): Promise<FontEntry[]> {
  const [anton, archivo, inter400, inter700, mono] = await Promise.all([
    loadGoogleFont("Anton", 400),
    loadGoogleFont("Archivo Black", 400),
    loadGoogleFont("Inter", 400),
    loadGoogleFont("Inter", 700),
    loadGoogleFont("JetBrains Mono", 400),
  ]);
  const out: FontEntry[] = [];
  if (anton) out.push({ name: "Anton", data: anton, weight: 400, style: "normal" });
  if (archivo)
    out.push({ name: "ArchivoBlack", data: archivo, weight: 400, style: "normal" });
  if (inter400)
    out.push({ name: "Inter", data: inter400, weight: 400, style: "normal" });
  if (inter700)
    out.push({ name: "Inter", data: inter700, weight: 700, style: "normal" });
  if (mono)
    out.push({ name: "JetBrainsMono", data: mono, weight: 400, style: "normal" });
  return out;
}

function getOrigin(req: Request): string {
  try {
    const u = new URL(req.url);
    if (u.protocol && u.host) return `${u.protocol}//${u.host}`;
  } catch {
    /* ignore */
  }
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export async function GET(req: Request, { params }: { params: Params }) {
  const { id } = await params;
  const ranking = await getRankingById(id);
  if (!ranking) {
    return new Response("Not found", { status: 404 });
  }

  const meta = await getVotingById(ranking.voting);
  if (!meta) {
    return new Response("Voting not found", { status: 404 });
  }

  const origin = getOrigin(req);
  const votingLogoSrc = meta.logo_url.startsWith("http")
    ? meta.logo_url
    : `${origin}${meta.logo_url}`;

  const rows = ranking.positions.map((teamAbbr, idx) => {
    const team = findTeamByAbbr(teamAbbr);
    return {
      pos: idx + 1,
      name: team ? `${team.location} ${team.name}` : "—",
      teamAbbr: team?.abbr ?? "??",
      teamColor: team?.primaryColor ?? "#222",
      teamText: team?.secondaryColor ?? "#fff",
      logoUrl: team ? teamLogoUrl(team.abbr) : null,
    };
  });

  const leftCol = rows.slice(0, 16);
  const rightCol = rows.slice(16, 32);

  const fonts = await loadAllFonts();
  const fontDisplay = fonts.some((f) => f.name === "Anton") ? "Anton" : "Inter";
  const fontSubhead = fonts.some((f) => f.name === "ArchivoBlack")
    ? "ArchivoBlack"
    : "Inter";
  const fontMono = fonts.some((f) => f.name === "JetBrainsMono")
    ? "JetBrainsMono"
    : "Inter";

  // Auto-shrink del nombre en una sola línea según longitud.
  const nameLen = ranking.full_name.length;
  const nameFontSize = nameLen <= 20 ? 80 : nameLen <= 26 ? 64 : 52;

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: WIDTH,
            height: HEIGHT,
            display: "flex",
            flexDirection: "column",
            background: BG,
            color: FG,
            fontFamily: "Inter",
            padding: 60,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 24,
              paddingBottom: 24,
              borderBottom: `6px solid ${ACCENT}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img
              src={votingLogoSrc}
              width={120}
              height={120}
              style={{
                borderRadius: 999,
                objectFit: "cover",
                border: `3px solid ${FG}`,
              }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontFamily: fontSubhead,
                  fontSize: 24,
                  color: ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {meta.name} · 2026
              </span>
              <span
                style={{
                  fontFamily: fontDisplay,
                  fontSize: 80,
                  lineHeight: 0.95,
                  textTransform: "uppercase",
                  color: FG,
                }}
              >
                Ranking de
              </span>
              <span
                style={{
                  fontFamily: fontDisplay,
                  fontSize: nameFontSize,
                  lineHeight: 1,
                  textTransform: "uppercase",
                  color: FG,
                }}
              >
                {ranking.full_name}
              </span>
            </div>
          </div>

          {/* Two columns */}
          <div style={{ display: "flex", gap: 24, marginTop: 28, flex: 1 }}>
            {[leftCol, rightCol].map((col, ci) => (
              <div
                key={ci}
                style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}
              >
                {col.map((r) => (
                  <div
                    key={r.pos}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      background: SURFACE,
                      border: `1px solid ${BORDER}`,
                      borderRadius: 14,
                      padding: "8px 14px",
                      height: 72,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        width: 56,
                        justifyContent: "center",
                        fontFamily: fontMono,
                        fontSize: 30,
                        color: FG,
                      }}
                    >
                      {r.pos.toString().padStart(2, "0")}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 52,
                        height: 52,
                      }}
                    >
                      {r.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                        <img
                          src={r.logoUrl}
                          width={52}
                          height={52}
                          style={{ objectFit: "contain" }}
                        />
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: 52,
                            height: 52,
                            borderRadius: 999,
                            background: r.teamColor,
                            color: r.teamText,
                            fontFamily: "Inter",
                            fontSize: 18,
                            fontWeight: 700,
                            border: `2px solid ${r.teamText}`,
                          }}
                        >
                          {r.teamAbbr}
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "Inter",
                          fontWeight: 700,
                          fontSize: 24,
                          color: FG,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {r.name}
                      </span>
                      <span
                        style={{ fontFamily: fontMono, fontSize: 16, color: MUTED }}
                      >
                        {r.teamAbbr}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 28,
              paddingTop: 18,
              borderTop: `1px solid ${BORDER}`,
              color: MUTED,
              fontFamily: fontSubhead,
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            <span>Haz tu propio top 32</span>
            <span style={{ color: ACCENT }}>{meta.name}</span>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
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
