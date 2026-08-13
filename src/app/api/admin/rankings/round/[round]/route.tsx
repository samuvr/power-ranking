import { ImageResponse } from "next/og";
import { getRankingsByVoting, getVoting } from "@/lib/db/client";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { findTeamByAbbr, teamLogoUrl } from "@/data/teams";
import { isAdminAuthenticated } from "@/lib/auth";
import { getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";

export const runtime = "nodejs";

const SIZE = 1080;

const BG = "#F4EEDC";
const FG = "#0A2240";
const ACCENT = "#C8102E";
const SURFACE = "#FBF7E8";
const BORDER = "rgba(10, 34, 64, 0.18)";
const MUTED = "rgba(10, 34, 64, 0.6)";

type Params = Promise<{ round: string }>;

export async function GET(req: Request, { params }: { params: Params }) {
  const { round: roundParam } = await params;

  if (!(await isAdminAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const voting = await getVoting();
  if (!voting) return new Response("Not found", { status: 404 });

  const rows = await getRankingsByVoting(voting.id);
  if (rows.length === 0) return new Response("No submissions", { status: 404 });

  const result = computeGlobalRanking(rows.map((r) => r.positions));

  const roundIndex = parseInt(roundParam, 10);
  if (isNaN(roundIndex) || roundIndex < 0 || roundIndex >= result.rounds.length) {
    return new Response("Invalid round", { status: 400 });
  }

  const breakdown = result.rounds[roundIndex];
  const [low, high] = breakdown.positionsAssigned;
  const totalRounds = result.rounds.length;

  // Equipos de esta fase, ordenados de peor (mayor posición) a mejor
  const entries = result.ranking
    .filter((e) => e.roundIndex === roundIndex)
    .sort((a, b) => b.finalPosition - a.finalPosition);

  const origin = getOrigin(req);
  const votingLogoSrc = voting.logo_url.startsWith("http")
    ? voting.logo_url
    : `${origin}${voting.logo_url}`;

  const fonts = await loadAllFonts();
  const { display: fontDisplay, subhead: fontSubhead, mono: fontMono } =
    resolveFontNames(fonts);

  const accent = voting.accent || ACCENT;

  // Altura disponible para las cards tras header + bloque de fase + footer
  const PAD = 56;
  const HEADER_H = 110;
  const SEP_H = 24;
  const PHASE_H = 130;
  const FOOTER_H = 64;
  const cardsArea =
    SIZE - PAD * 2 - HEADER_H - SEP_H - PHASE_H - SEP_H - FOOTER_H - 24;
  const cardGap = 12;
  const cardH = Math.floor((cardsArea - cardGap * (entries.length - 1)) / entries.length);

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: SIZE,
            height: SIZE,
            display: "flex",
            flexDirection: "column",
            background: BG,
            color: FG,
            fontFamily: "Inter",
            padding: PAD,
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 20,
              height: HEADER_H,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img
              src={votingLogoSrc}
              width={80}
              height={80}
              style={{ borderRadius: 999, objectFit: "cover", border: `3px solid ${FG}` }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontFamily: fontSubhead,
                  fontSize: 20,
                  color: ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                Ranking Global · 2026
              </span>
              <span
                style={{
                  fontFamily: fontDisplay,
                  fontSize: 52,
                  lineHeight: 1,
                  textTransform: "uppercase",
                  color: FG,
                }}
              >
                {voting.name}
              </span>
            </div>
          </div>

          {/* Separador */}
          <div style={{ display: "flex", height: 6, background: ACCENT, marginBottom: 18 }} />

          {/* Bloque de fase */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: PHASE_H,
              justifyContent: "center",
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: fontSubhead,
                fontSize: 22,
                color: MUTED,
                textTransform: "uppercase",
                letterSpacing: 3,
              }}
            >
              Fase {roundIndex + 1} de {totalRounds}
            </span>
            <span
              style={{
                fontFamily: fontMono,
                fontSize: 64,
                fontWeight: 700,
                color: accent,
                lineHeight: 1,
              }}
            >
              Puestos {low}–{high}
            </span>
          </div>

          {/* Separador fino */}
          <div
            style={{
              display: "flex",
              height: 1,
              background: BORDER,
              marginBottom: 18,
            }}
          />

          {/* Lista de equipos */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              gap: cardGap,
            }}
          >
            {entries.map((entry) => {
              const team = findTeamByAbbr(entry.teamAbbr);
              const logoUrl = team ? teamLogoUrl(team.abbr) : null;
              const teamColor = team?.primaryColor ?? "#222";
              const teamText = team?.secondaryColor ?? "#fff";

              return (
                <div
                  key={entry.teamAbbr}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 16,
                    background: SURFACE,
                    border: `1px solid ${BORDER}`,
                    borderLeft: `5px solid ${accent}`,
                    borderRadius: 16,
                    padding: "0 20px",
                    height: cardH,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: 72,
                      justifyContent: "center",
                      fontFamily: fontMono,
                      fontSize: 44,
                      fontWeight: 700,
                      color: FG,
                    }}
                  >
                    {entry.finalPosition.toString().padStart(2, "0")}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 64,
                      height: 64,
                    }}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                      <img
                        src={logoUrl}
                        width={64}
                        height={64}
                        style={{ objectFit: "contain" }}
                      />
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: 64,
                          height: 64,
                          borderRadius: 999,
                          background: teamColor,
                          color: teamText,
                          fontFamily: "Inter",
                          fontSize: 20,
                          fontWeight: 700,
                          border: `2px solid ${teamText}`,
                        }}
                      >
                        {team?.abbr ?? "??"}
                      </div>
                    )}
                  </div>
                  <div
                    style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}
                  >
                    <span
                      style={{
                        fontFamily: "Inter",
                        fontWeight: 700,
                        fontSize: 32,
                        color: FG,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {team ? `${team.location} ${team.name}` : entry.teamAbbr}
                    </span>
                    <span style={{ fontFamily: fontMono, fontSize: 20, color: MUTED }}>
                      {team?.abbr ?? "??"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer con puntos de progreso */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: 18,
              height: FOOTER_H,
              borderTop: `1px solid ${BORDER}`,
              paddingTop: 14,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              {Array.from({ length: totalRounds }, (_, i) => (
                <div
                  key={i}
                  style={{
                    width: i === roundIndex ? 32 : 12,
                    height: 10,
                    borderRadius: 999,
                    background: i === roundIndex ? accent : BORDER,
                  }}
                />
              ))}
            </div>
            <span
              style={{
                fontFamily: fontSubhead,
                fontSize: 20,
                color: ACCENT,
                textTransform: "uppercase",
                letterSpacing: 2,
              }}
            >
              {voting.name}
            </span>
          </div>
        </div>
      ),
      {
        width: SIZE,
        height: SIZE,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: { "Cache-Control": "private, max-age=300" },
      },
    );
  } catch (err) {
    console.error("Failed to render PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}
