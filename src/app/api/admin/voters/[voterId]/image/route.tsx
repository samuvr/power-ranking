import { ImageResponse } from "next/og";
import {
  getRankingById,
  getRankingsByVoting,
  getVoting,
} from "@/lib/db/client";
import { findTeamByAbbr, teamLogoUrl } from "@/data/teams";
import {
  computeDeviationLeaveOneOut,
  topOverratedUnderrated,
  type DeviationEntry,
} from "@/lib/ranking-deviation";
import { isAdminAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";

const WIDTH = 1080;
const HEIGHT = 2160;

const BG = "#F4EEDC";
const FG = "#0A2240";
const ACCENT = "#C8102E";
const SURFACE = "#FBF7E8";
const BORDER = "rgba(10, 34, 64, 0.18)";
const MUTED = "rgba(10, 34, 64, 0.6)";
const GREEN = "#15803d";
const RED = "#b91c1c";

type Params = Promise<{ voterId: string }>;

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
  const { voterId } = await params;

  if (!(await isAdminAuthenticated())) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ranking = await getRankingById(voterId);
  if (!ranking) {
    return new Response("Not found", { status: 404 });
  }

  const meta = await getVoting();
  if (!meta || meta.id !== ranking.voting) {
    return new Response("Voting not found", { status: 404 });
  }

  const allRows = await getRankingsByVoting(ranking.voting);
  const deviation = computeDeviationLeaveOneOut(
    ranking.positions,
    allRows.filter((r) => r.id !== ranking.id).map((r) => r.positions),
  );
  const { overrated, underrated } = topOverratedUnderrated(deviation.perTeam, 3);
  const diffByTeam = new Map<string, number>();
  for (const e of deviation.perTeam) diffByTeam.set(e.teamAbbr, e.diff);

  const origin = getOrigin(req);
  const votingLogoSrc = meta.logo_url.startsWith("http")
    ? meta.logo_url
    : `${origin}${meta.logo_url}`;

  const rows = ranking.positions.map((teamAbbr, idx) => {
    const team = findTeamByAbbr(teamAbbr);
    const diff = diffByTeam.get(teamAbbr);
    return {
      pos: idx + 1,
      name: team ? `${team.location} ${team.name}` : "—",
      teamAbbr: team?.abbr ?? "??",
      teamColor: team?.primaryColor ?? "#222",
      teamText: team?.secondaryColor ?? "#fff",
      logoUrl: team ? teamLogoUrl(team.abbr) : null,
      diff,
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

  const nameLen = ranking.full_name.length;
  const nameFontSize = nameLen <= 20 ? 80 : nameLen <= 26 ? 64 : 52;

  const meanDeviationStr = deviation.meanAbsDeviation.toLocaleString("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

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
              <span
                style={{
                  fontFamily: fontMono,
                  fontSize: 22,
                  color: MUTED,
                  marginTop: 6,
                }}
              >
                Desviación media: {meanDeviationStr}
              </span>
            </div>
          </div>

          {/* Two columns ranking */}
          <div style={{ display: "flex", gap: 24, marginTop: 28 }}>
            {[leftCol, rightCol].map((col, ci) => (
              <div
                key={ci}
                style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}
              >
                {col.map((r) => {
                  const diff = r.diff;
                  const diffColor =
                    diff === undefined || diff === 0
                      ? MUTED
                      : diff > 0
                        ? GREEN
                        : RED;
                  const diffText =
                    diff === undefined
                      ? "—"
                      : diff === 0
                        ? "="
                        : `${diff > 0 ? "+" : "−"}${Math.abs(diff)}`;
                  return (
                    <div
                      key={r.pos}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        background: SURFACE,
                        border: `1px solid ${BORDER}`,
                        borderRadius: 14,
                        padding: "8px 12px",
                        height: 72,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          width: 48,
                          justifyContent: "center",
                          fontFamily: fontMono,
                          fontSize: 28,
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
                            fontSize: 22,
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
                      <div
                        style={{
                          display: "flex",
                          fontFamily: fontMono,
                          fontSize: 20,
                          fontWeight: 700,
                          color: diffColor,
                          minWidth: 56,
                          justifyContent: "flex-end",
                        }}
                      >
                        {diffText}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Over/Under columns */}
          <div style={{ display: "flex", gap: 24, marginTop: 32 }}>
            <DeviationCol
              title="Más sobrevalorados"
              entries={overrated}
              accent={GREEN}
              fontSubhead={fontSubhead}
              fontMono={fontMono}
            />
            <DeviationCol
              title="Más infravalorados"
              entries={underrated}
              accent={RED}
              fontSubhead={fontSubhead}
              fontMono={fontMono}
            />
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: "auto",
              paddingTop: 18,
              borderTop: `1px solid ${BORDER}`,
              color: MUTED,
              fontFamily: fontSubhead,
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            <span>Ranking individual</span>
            <span style={{ color: ACCENT }}>{meta.name}</span>
          </div>
        </div>
      ),
      {
        width: WIDTH,
        height: HEIGHT,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: {
          "Cache-Control": "private, max-age=300",
        },
      },
    );
  } catch (err) {
    console.error("Failed to render PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}

function DeviationCol({
  title,
  entries,
  accent,
  fontSubhead,
  fontMono,
}: {
  title: string;
  entries: DeviationEntry[];
  accent: string;
  fontSubhead: string;
  fontMono: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 16,
        padding: 16,
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: fontSubhead,
          fontSize: 20,
          color: accent,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        {title}
      </div>
      {entries.length === 0 ? (
        <div style={{ display: "flex", color: MUTED, fontSize: 18 }}>—</div>
      ) : (
        entries.map((entry) => {
          const team = findTeamByAbbr(entry.teamAbbr);
          const logoUrl = team ? teamLogoUrl(team.abbr) : null;
          const sign = entry.diff > 0 ? "+" : "−";
          return (
            <div
              key={entry.teamAbbr}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: BG,
                border: `1px solid ${BORDER}`,
                borderRadius: 12,
                padding: "8px 10px",
                height: 72,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 48,
                  height: 48,
                }}
              >
                {logoUrl && (
                  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
                  <img
                    src={logoUrl}
                    width={48}
                    height={48}
                    style={{ objectFit: "contain" }}
                  />
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
                    fontSize: 18,
                    color: FG,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {team ? `${team.location} ${team.name}` : entry.teamAbbr}
                </span>
                <span style={{ fontFamily: fontMono, fontSize: 13, color: MUTED }}>
                  V#{entry.voterPos} · C#{entry.consensusPos}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: fontMono,
                  fontSize: 22,
                  fontWeight: 700,
                  color: accent,
                }}
              >
                {sign}
                {Math.abs(entry.diff)}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
