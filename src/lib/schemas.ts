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

const PositionsSchema = z
  .array(z.string())
  .length(TOTAL_TEAMS)
  .refine((arr) => new Set(arr).size === arr.length, {
    message: "positions must contain unique team ids",
  })
  .refine((arr) => arr.every((id) => TEAM_ABBR_SET.has(id)), {
    message: "positions contains an unknown team id",
  });

// El nombre y el email ya no viajan en el cuerpo: salen de la sesión.
export const RankingSubmissionSchema = z.object({
  positions: PositionsSchema,
});

export type RankingSubmission = z.infer<typeof RankingSubmissionSchema>;

const FullNameSchema = z.string().trim().min(2).max(30).transform(toTitleCase);
const EmailSchema = z.string().trim().toLowerCase().email().max(200);
const PasswordSchema = z.string().min(8, { message: "Mínimo 8 caracteres" }).max(200);

// El registro está cerrado a la comunidad: hace falta la contraseña de la
// votación, la misma que ya se pedía para votar.
export const RegisterSchema = z.object({
  fullName: FullNameSchema,
  email: EmailSchema,
  password: PasswordSchema,
  votingPassword: z.string().max(200).optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(200),
});

export const ProfileUpdateSchema = z
  .object({
    fullName: FullNameSchema.optional(),
    currentPassword: z.string().min(1).max(200).optional(),
    newPassword: PasswordSchema.optional(),
  })
  .refine((data) => !data.newPassword || !!data.currentPassword, {
    message: "Hace falta la contraseña actual para cambiarla",
    path: ["currentPassword"],
  });

export const SnapshotCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  // Por defecto solo entra quien haya actualizado desde el screenshot
  // anterior; marcando esto entran todos los rankings guardados.
  includeAll: z.boolean().optional().default(false),
});

export const SnapshotRenameSchema = z.object({
  name: z.string().trim().min(2).max(60),
});

export const AdminResetPasswordSchema = z.object({
  password: PasswordSchema,
});

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
