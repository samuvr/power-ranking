import { z } from "zod";
import { getTeamAbbrs, TOTAL_TEAMS } from "@/data/teams";

const TEAM_ABBR_SET = new Set(getTeamAbbrs());

// Normaliza a Title Case: minúsculas + capitaliza tras espacio, guión o apóstrofo.
// Maneja acentos (à-ÿ): "ANTONIO ANTON TOME" → "Antonio Anton Tome",
// "o'brien" → "O'Brien", "jean-pierre" → "Jean-Pierre", "garcía" → "García".
function toTitleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s\-'])([a-zà-ÿ])/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

export const RankingSubmissionSchema = z.object({
  fullName: z.string().trim().min(2).max(30).transform(toTitleCase),
  email: z.string().trim().toLowerCase().email().max(200),
  positions: z
    .array(z.string())
    .length(TOTAL_TEAMS)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "positions must contain unique team ids",
    })
    .refine((arr) => arr.every((id) => TEAM_ABBR_SET.has(id)), {
      message: "positions contains an unknown team id",
    }),
});

export type RankingSubmission = z.infer<typeof RankingSubmissionSchema>;

export const AdminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

// Ajustes editables de la (única) votación. Todo opcional: el PATCH aplica
// solo los campos presentes.
export const VotingUpdateSchema = z.object({
  name: z.string().trim().min(2).max(60).optional(),
  shortName: z.string().trim().min(2).max(8).optional(),
  description: z.string().trim().min(2).max(140).optional(),
  accent: z.string().regex(HEX_COLOR_RE, { message: "accent must be #RRGGBB" }).optional(),
  accentDark: z
    .string()
    .regex(HEX_COLOR_RE, { message: "accentDark must be #RRGGBB" })
    .optional(),
  logoUrl: z.string().trim().min(1).max(500).optional(),
  active: z.boolean().optional(),
  publicAccess: z.boolean().optional(),
  voterPassword: z.string().min(4).max(100).optional(),
});

export type VotingUpdateInput = z.infer<typeof VotingUpdateSchema>;

export const VotingAccessSchema = z.object({
  password: z.string().max(200).optional(),
});
