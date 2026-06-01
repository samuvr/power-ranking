import { z } from "zod";
import { getQbIds, TOTAL_QBS } from "@/data/qbs";

const QB_ID_SET = new Set(getQbIds());

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
  voting: z.guid(),
  positions: z
    .array(z.string())
    .length(TOTAL_QBS)
    .refine((arr) => new Set(arr).size === arr.length, {
      message: "positions must contain unique QB ids",
    })
    .refine((arr) => arr.every((id) => QB_ID_SET.has(id)), {
      message: "positions contains an unknown QB id",
    }),
});

export type RankingSubmission = z.infer<typeof RankingSubmissionSchema>;

export const AdminLoginSchema = z.object({
  password: z.string().min(1).max(200),
});

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export const VotingCreateSchema = z.object({
  slug: z.string().trim().min(2).max(40).regex(SLUG_RE, {
    message: "slug must be lowercase alphanumeric with hyphens",
  }),
  name: z.string().trim().min(2).max(60),
  shortName: z.string().trim().min(2).max(8),
  description: z.string().trim().min(2).max(140),
  accent: z.string().regex(HEX_COLOR_RE, { message: "accent must be #RRGGBB" }),
  accentDark: z.string().regex(HEX_COLOR_RE, { message: "accentDark must be #RRGGBB" }),
  logoUrl: z.string().trim().min(1).max(500),
  publicAccess: z.boolean().optional().default(false),
  voterPassword: z.string().min(4).max(100).optional(),
  adminPassword: z.string().min(4).max(100),
});

export type VotingCreateInput = z.infer<typeof VotingCreateSchema>;

export const VotingUpdateSchema = VotingCreateSchema.partial().extend({
  active: z.boolean().optional(),
  publicAccess: z.boolean().optional(),
});

export type VotingUpdateInput = z.infer<typeof VotingUpdateSchema>;

export const VotingReorderSchema = z.object({
  orderedIds: z.array(z.guid()).min(1).max(64),
});

export const DuplicateRankingsSchema = z.object({
  targetVotingId: z.guid(),
});

export const VotingAccessSchema = z.object({
  password: z.string().max(200).optional(),
});

export const PasswordRequiredSchema = z.object({
  password: z.string().min(1).max(200),
});
