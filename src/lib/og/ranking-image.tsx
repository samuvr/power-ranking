import type { ReactNode } from "react";
import { findTeamByAbbr, teamLogoUrl } from "@/data/teams";
import type { FontNames } from "./fonts";
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
} from "./theme";

export type ImageRow = {
  pos: number;
  name: string;
  teamAbbr: string;
  teamColor: string;
  teamText: string;
  logoUrl: string | null;
  /** Puestos ganados respecto a la foto anterior; null = no se pinta. */
  delta: number | null;
  /** Línea pequeña bajo el nombre. Por defecto, la abreviatura. */
  subline?: string;
  sublineColor?: string;
};

/** Convierte una lista ordenada de abbr en filas listas para pintar. */
export function buildImageRows(
  positions: string[],
  deltaByTeam?: Map<string, number | null> | null,
): ImageRow[] {
  return positions.map((teamAbbr, idx) => {
    const team = findTeamByAbbr(teamAbbr);
    return {
      pos: idx + 1,
      name: team ? `${team.location} ${team.name}` : "—",
      teamAbbr: team?.abbr ?? "??",
      teamColor: team?.primaryColor ?? "#222",
      teamText: team?.secondaryColor ?? "#fff",
      logoUrl: team ? teamLogoUrl(team.abbr) : null,
      delta: deltaByTeam?.get(teamAbbr) ?? null,
    };
  });
}

export function DeltaCell({ delta, fontMono }: { delta: number | null; fontMono: string }) {
  if (delta === null) {
    return <div style={{ display: "flex", width: 58 }} />;
  }
  if (delta === 0) {
    return (
      <div
        style={{
          display: "flex",
          width: 58,
          justifyContent: "flex-end",
          fontFamily: fontMono,
          fontSize: 22,
          color: MUTED,
        }}
      >
        =
      </div>
    );
  }
  const up = delta > 0;
  return (
    <div
      style={{
        display: "flex",
        width: 58,
        justifyContent: "flex-end",
        alignItems: "center",
        fontFamily: fontMono,
        fontSize: 22,
        fontWeight: 700,
        color: up ? GREEN : RED,
      }}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </div>
  );
}

function TeamRow({ row, fonts }: { row: ImageRow; fonts: FontNames }) {
  return (
    <div
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
          width: 46,
          justifyContent: "center",
          fontFamily: fonts.mono,
          fontSize: 28,
          color: FG,
        }}
      >
        {row.pos.toString().padStart(2, "0")}
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
        {row.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={row.logoUrl} width={52} height={52} style={{ objectFit: "contain" }} />
        ) : (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 52,
              height: 52,
              borderRadius: 999,
              background: row.teamColor,
              color: row.teamText,
              fontFamily: "Inter",
              fontSize: 18,
              fontWeight: 700,
              border: `2px solid ${row.teamText}`,
            }}
          >
            {row.teamAbbr}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
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
          {row.name}
        </span>
        <span
          style={{ fontFamily: fonts.mono, fontSize: 16, color: row.sublineColor ?? MUTED }}
        >
          {row.subline ?? row.teamAbbr}
        </span>
      </div>
      <DeltaCell delta={row.delta} fontMono={fonts.mono} />
    </div>
  );
}

type Props = {
  logoSrc: string;
  eyebrow: string;
  /** Líneas del titular; la última se encoge según su longitud. */
  titleLines: string[];
  rows: ImageRow[];
  footerLeft: string;
  footerRight: string;
  fonts: FontNames;
  /** Bloque opcional entre las columnas y el pie. */
  extra?: ReactNode;
};

/**
 * Layout base 1080×1920: cabecera, 32 equipos en dos columnas con su flecha
 * de evolución y pie. Lo comparten la imagen individual, la del consensus y
 * las de los screenshots congelados.
 */
export function RankingImage({
  logoSrc,
  eyebrow,
  titleLines,
  rows,
  footerLeft,
  footerRight,
  fonts,
  extra,
}: Props) {
  const leftCol = rows.slice(0, 16);
  const rightCol = rows.slice(16, 32);
  const last = titleLines[titleLines.length - 1] ?? "";
  const lastSize = last.length <= 16 ? 80 : last.length <= 22 ? 64 : 52;

  return (
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
          src={logoSrc}
          width={120}
          height={120}
          style={{ borderRadius: 999, objectFit: "cover", border: `3px solid ${FG}` }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: fonts.subhead,
              fontSize: 24,
              color: ACCENT,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {eyebrow}
          </span>
          {titleLines.map((line, idx) => (
            <span
              key={idx}
              style={{
                fontFamily: fonts.display,
                fontSize: idx === titleLines.length - 1 ? lastSize : 80,
                lineHeight: 1,
                textTransform: "uppercase",
                color: FG,
              }}
            >
              {line}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 28, flex: 1 }}>
        {[leftCol, rightCol].map((col, ci) => (
          <div key={ci} style={{ display: "flex", flexDirection: "column", flex: 1, gap: 8 }}>
            {col.map((row) => (
              <TeamRow key={row.pos} row={row} fonts={fonts} />
            ))}
          </div>
        ))}
      </div>

      {extra}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 28,
          paddingTop: 18,
          borderTop: `1px solid ${BORDER}`,
          color: MUTED,
          fontFamily: fonts.subhead,
          fontSize: 22,
          textTransform: "uppercase",
          letterSpacing: 2,
        }}
      >
        <span>{footerLeft}</span>
        <span style={{ color: ACCENT }}>{footerRight}</span>
      </div>
    </div>
  );
}
