import { findTeamByAbbr, teamLogoUrl } from "@/data/teams";
import type { FontNames } from "./fonts";
import { ACCENT, BG, BORDER, FG, IMAGE_SQUARE, MUTED, SURFACE } from "./theme";

export type RoundImageEntry = {
  teamAbbr: string;
  finalPosition: number;
};

type Props = {
  logoSrc: string;
  eyebrow: string;
  title: string;
  /** Índice 0-based de la fase. */
  roundIndex: number;
  totalRounds: number;
  /** Puestos que se cierran en esta fase, [peor, mejor]. */
  positionsAssigned: [number, number];
  /** Equipos de la fase, ya ordenados de peor a mejor puesto. */
  entries: RoundImageEntry[];
  accent: string;
  footerRight: string;
  fonts: FontNames;
};

/**
 * Layout cuadrado 1080×1080 de una fase del algoritmo: cabecera, los puestos
 * que se cierran, los equipos que caen en ellos y unos puntos de progreso.
 * Pensado para publicarse como carrusel. Lo comparten el ranking global en
 * vivo (admin) y el consensus congelado de un screenshot.
 */
export function RoundImage({
  logoSrc,
  eyebrow,
  title,
  roundIndex,
  totalRounds,
  positionsAssigned,
  entries,
  accent,
  footerRight,
  fonts,
}: Props) {
  const [low, high] = positionsAssigned;

  // Altura disponible para las cards tras header + bloque de fase + footer
  const PAD = 56;
  const HEADER_H = 110;
  const SEP_H = 24;
  const PHASE_H = 130;
  const FOOTER_H = 64;
  const cardsArea =
    IMAGE_SQUARE - PAD * 2 - HEADER_H - SEP_H - PHASE_H - SEP_H - FOOTER_H - 24;
  const cardGap = 12;
  const cardH = Math.floor(
    (cardsArea - cardGap * (entries.length - 1)) / Math.max(entries.length, 1),
  );
  const titleSize = title.length <= 16 ? 52 : title.length <= 24 ? 42 : 34;

  return (
    <div
      style={{
        width: IMAGE_SQUARE,
        height: IMAGE_SQUARE,
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
          src={logoSrc}
          width={80}
          height={80}
          style={{ borderRadius: 999, objectFit: "cover", border: `3px solid ${FG}` }}
        />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: fonts.subhead,
              fontSize: 20,
              color: ACCENT,
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            {eyebrow}
          </span>
          <span
            style={{
              fontFamily: fonts.display,
              fontSize: titleSize,
              lineHeight: 1,
              textTransform: "uppercase",
              color: FG,
            }}
          >
            {title}
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
            fontFamily: fonts.subhead,
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
            fontFamily: fonts.mono,
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
                  fontFamily: fonts.mono,
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
              <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
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
                <span style={{ fontFamily: fonts.mono, fontSize: 20, color: MUTED }}>
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
            fontFamily: fonts.subhead,
            fontSize: 20,
            color: ACCENT,
            textTransform: "uppercase",
            letterSpacing: 2,
          }}
        >
          {footerRight}
        </span>
      </div>
    </div>
  );
}
