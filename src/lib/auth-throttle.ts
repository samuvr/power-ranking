import { NextResponse } from "next/server";
import type { RateLimitResult, RateLimitRule } from "@/lib/rate-limit";

/**
 * Cupos de intentos fallidos para las rutas de autenticación. Solo cuentan los
 * fallos, así que un votante que se equivoca una vez y acierta a la segunda no
 * gasta nada: los números están puestos para molestar a quien prueba a ciegas.
 */
const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Por email: corta la fuerza bruta contra una cuenta concreta. */
export const LOGIN_EMAIL_RULE: RateLimitRule = { limit: 8, windowMs: FIFTEEN_MINUTES };

/**
 * Por IP: más holgado a propósito, porque la comunidad puede entrar varias
 * personas desde la misma wifi y no queremos bloquear a un grupo entero.
 */
export const LOGIN_IP_RULE: RateLimitRule = { limit: 25, windowMs: FIFTEEN_MINUTES };

/**
 * Registro: cada intento con la contraseña de comunidad equivocada gasta un
 * bcrypt del servidor, así que aquí el límite protege también de la CPU.
 */
export const REGISTER_IP_RULE: RateLimitRule = { limit: 10, windowMs: FIFTEEN_MINUTES };

/** Panel de admin: una sola contraseña, la más apetecible de adivinar. */
export const ADMIN_LOGIN_IP_RULE: RateLimitRule = { limit: 8, windowMs: FIFTEEN_MINUTES };

function humanWait(seconds: number): string {
  if (seconds < 60) return `${seconds} segundos`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "un minuto" : `${minutes} minutos`;
}

/** Respuesta 429 con `Retry-After`, para cuando la clave ya no tiene cupo. */
export function tooManyAttempts(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    {
      error: `Demasiados intentos fallidos. Vuelve a probar en ${humanWait(
        result.retryAfterSeconds,
      )}.`,
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSeconds) } },
  );
}
