import { ImageResponse } from "next/og";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getLatestSnapshot,
  getRankingsByVoting,
  getSnapshotById,
  getVoting,
} from "@/lib/db/client";
import { findTeamByAbbr, teamLogoUrl } from "@/data/teams";
import { computeGlobalRanking } from "@/lib/ranking-algorithm";
import { computeEvolution, topMovers, type Evolution } from "@/lib/ranking-evolution";
import { absoluteLogoUrl, getOrigin, loadAllFonts, resolveFontNames } from "@/lib/og/fonts";
import type { FontNames } from "@/lib/og/fonts";
import {
  ACCENT,
  BG,
  BORDER,
  FG,
  GREEN,
  IMAGE_HEIGHT,
  IMAGE_WIDTH,
  MUTED,
  RED,
  SURFACE,
  dateFormatter,
} from "@/lib/og/theme";

export const runtime = "nodejs";

function MoverCard({
  evolution,
  fonts,
  color,
}: {
  evolution: Evolution;
  fonts: FontNames;
  color: string;
}) {
  const team = findTeamByAbbr(evolution.teamAbbr);
  const up = (evolution.delta ?? 0) > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 24,
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderLeft: `10px solid ${color}`,
        borderRadius: 20,
        padding: "18px 28px",
        height: 150,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
      <img
        src={teamLogoUrl(evolution.teamAbbr)}
        width={110}
        height={110}
        style={{ objectFit: "contain" }}
      />
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "Inter",
            fontWeight: 700,
            fontSize: 40,
            color: FG,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {team ? `${team.location} ${team.name}` : evolution.teamAbbr}
        </span>
        <span style={{ fontFamily: fonts.mono, fontSize: 26, color: MUTED }}>
          #{evolution.previousPosition} → #{evolution.position}
        </span>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          fontFamily: fonts.display,
          fontSize: 72,
          color,
        }}
      >
        {up ? "▲" : "▼"}
        {Math.abs(evolution.delta ?? 0)}
      </div>
    </div>
  );
}

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

  const baseId = new URL(req.url).searchParams.get("base");
  const base = baseId ? await getSnapshotById(baseId) : await getLatestSnapshot(voting.id);
  const usableBase = base && base.voting === voting.id ? base : null;
  if (!usableBase) {
    return new Response("Sin screenshot con el que comparar", { status: 404 });
  }

  const evolutions = computeEvolution(positions, usableBase.consensus);
  const { risers, fallers } = topMovers(evolutions, 3);

  const origin = getOrigin(req);
  const fonts = await loadAllFonts();
  const f = resolveFontNames(fonts);

  try {
    return new ImageResponse(
      (
        <div
          style={{
            width: IMAGE_WIDTH,
            height: IMAGE_HEIGHT,
            display: "flex",
            flexDirection: "column",
            background: BG,
            color: FG,
            fontFamily: "Inter",
            padding: 60,
          }}
        >
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
              src={absoluteLogoUrl(voting.logo_url, origin)}
              width={120}
              height={120}
              style={{ borderRadius: 999, objectFit: "cover", border: `3px solid ${FG}` }}
            />
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span
                style={{
                  fontFamily: f.subhead,
                  fontSize: 24,
                  color: ACCENT,
                  textTransform: "uppercase",
                  letterSpacing: 2,
                }}
              >
                {dateFormatter.format(new Date())} · vs {usableBase.name}
              </span>
              <span
                style={{
                  fontFamily: f.display,
                  fontSize: 92,
                  lineHeight: 1,
                  textTransform: "uppercase",
                  color: FG,
                }}
              >
                Movers
              </span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 40, flex: 1 }}>
            <span
              style={{
                fontFamily: f.subhead,
                fontSize: 34,
                color: GREEN,
                textTransform: "uppercase",
                letterSpacing: 3,
              }}
            >
              Los que más suben
            </span>
            {risers.length === 0 ? (
              <span style={{ fontFamily: "Inter", fontSize: 28, color: MUTED }}>
                Nadie sube respecto a {usableBase.name}.
              </span>
            ) : (
              risers.map((e) => (
                <MoverCard key={e.teamAbbr} evolution={e} fonts={f} color={GREEN} />
              ))
            )}

            <span
              style={{
                fontFamily: f.subhead,
                fontSize: 34,
                color: RED,
                textTransform: "uppercase",
                letterSpacing: 3,
                marginTop: 24,
              }}
            >
              Los que más bajan
            </span>
            {fallers.length === 0 ? (
              <span style={{ fontFamily: "Inter", fontSize: 28, color: MUTED }}>
                Nadie baja respecto a {usableBase.name}.
              </span>
            ) : (
              fallers.map((e) => (
                <MoverCard key={e.teamAbbr} evolution={e} fonts={f} color={RED} />
              ))
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 28,
              paddingTop: 18,
              borderTop: `1px solid ${BORDER}`,
              color: MUTED,
              fontFamily: f.subhead,
              fontSize: 22,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            <span>Consensus de la comunidad</span>
            <span style={{ color: ACCENT }}>{voting.name}</span>
          </div>
        </div>
      ),
      {
        width: IMAGE_WIDTH,
        height: IMAGE_HEIGHT,
        fonts: fonts.length > 0 ? fonts : undefined,
        headers: { "Cache-Control": "private, max-age=60" },
      },
    );
  } catch (err) {
    console.error("Failed to render movers PNG", err);
    return new Response("Failed to render PNG", { status: 500 });
  }
}
