import { ImageResponse } from "next/og";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getLatestSnapshotEntryByEmail,
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
import { computeEvolution } from "@/lib/ranking-evolution";
import { absoluteLogoUrl, getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";
import { RankingImage, buildImageRows } from "@/lib/og/ranking-image";
import {
  BG,
  BORDER,
  FG,
  GREEN,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  MUTED,
  RED,
  SURFACE,
} from "@/lib/og/theme";

export const runtime = "nodejs";

type Params = Promise<{ voterId: string }>;

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

  // Evolución respecto a la última foto en la que aparece este votante.
  const previous = await getLatestSnapshotEntryByEmail(ranking.email, ranking.voting);
  const deltaByTeam = new Map<string, number | null>(
    computeEvolution(ranking.positions, previous?.positions ?? null).map((e) => [
      e.teamAbbr,
      e.delta,
    ]),
  );

  const origin = getOrigin(req);
  const fonts = await loadAllFonts();
  const f = resolveFontNames(fonts);

  // La desviación frente al consenso va en la línea pequeña; la flecha de
  // evolución, en la columna de la derecha.
  const rows = buildImageRows(ranking.positions, deltaByTeam).map((row) => {
    const diff = diffByTeam.get(row.teamAbbr);
    if (diff === undefined || diff === 0) return row;
    const sign = diff > 0 ? "+" : "−";
    return {
      ...row,
      subline: `${row.teamAbbr} · Δ${sign}${Math.abs(diff)}`,
      sublineColor: diff > 0 ? GREEN : RED,
    };
  });

  try {
    return new ImageResponse(
      (
        <RankingImage
          logoSrc={absoluteLogoUrl(meta.logo_url, origin)}
          eyebrow={`${meta.name} · 2026`}
          titleLines={["Ranking de", ranking.full_name]}
          rows={rows}
          footerLeft={previous ? `Evolución vs ${previous.snapshot_name}` : "Ranking individual"}
          footerRight={meta.name}
          fonts={f}
          extra={
            <div style={{ display: "flex", gap: 24, marginTop: 28 }}>
              <DeviationCol
                title="Más sobrevalorados"
                entries={overrated}
                accent={GREEN}
                fontSubhead={f.subhead}
                fontMono={f.mono}
              />
              <DeviationCol
                title="Más infravalorados"
                entries={underrated}
                accent={RED}
                fontSubhead={f.subhead}
                fontMono={f.mono}
              />
            </div>
          }
        />
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: { "Cache-Control": "private, max-age=300" },
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
                  <img src={logoUrl} width={48} height={48} style={{ objectFit: "contain" }} />
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
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
