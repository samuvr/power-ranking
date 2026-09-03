/**
 * Limitador de intentos en memoria, pensado para el login y el registro.
 *
 * Solo se consumen intentos **fallidos** (`consumeAttempt`): quien acierta la
 * contraseña no gasta cupo, así que un uso normal nunca se topa con el límite.
 * Un acierto además limpia el contador de esa clave, para que una racha de
 * fallos previos no penalice a quien acaba entrando bien.
 *
 * Limitación conocida: el contador vive en el proceso, y en Vercel hay varias
 * instancias, así que un atacante repartido entre ellas consigue más intentos
 * de los que dice el límite. Aun así corta en seco la fuerza bruta desde un
 * origen (que es el caso real) y, sobre todo, frena el gasto de CPU en bcrypt.
 * La alternativa —una tabla en Postgres— añade una escritura por intento y
 * una migración de la que dependería el login para funcionar.
 */

export type RateLimitRule = {
  /** Intentos fallidos permitidos dentro de la ventana. */
  limit: number;
  /** Tamaño de la ventana deslizante, en milisegundos. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Intentos fallidos que quedan antes de bloquear. */
  remaining: number;
  /** Segundos hasta que vuelva a haber cupo (0 si todavía lo hay). */
  retryAfterSeconds: number;
};

/** Cuántas claves distintas se recuerdan antes de tirar las más antiguas. */
const MAX_TRACKED_KEYS = 10_000;

// Marcas de tiempo de los fallos de cada clave, de más antigua a más reciente.
// Un Map conserva el orden de inserción: eso basta para desalojar por LRU.
const failures = new Map<string, number[]>();

function prune(timestamps: number[], now: number, windowMs: number): number[] {
  const cutoff = now - windowMs;
  // Están ordenadas: basta con saltar las que ya se han salido de la ventana.
  let i = 0;
  while (i < timestamps.length && timestamps[i] <= cutoff) i++;
  return i === 0 ? timestamps : timestamps.slice(i);
}

function touch(key: string, timestamps: number[]): void {
  // Reinsertar mueve la clave al final: las del principio son las más viejas.
  failures.delete(key);
  failures.set(key, timestamps);
  while (failures.size > MAX_TRACKED_KEYS) {
    const oldest = failures.keys().next();
    if (oldest.done) break;
    failures.delete(oldest.value);
  }
}

/**
 * Consulta el estado de una clave sin gastar intento. Se llama antes de hacer
 * el trabajo caro (bcrypt) para rechazar cuanto antes.
 */
export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitResult {
  const current = prune(failures.get(key) ?? [], now, rule.windowMs);
  if (current.length === 0) {
    failures.delete(key);
    return { allowed: true, remaining: rule.limit, retryAfterSeconds: 0 };
  }
  touch(key, current);

  if (current.length < rule.limit) {
    return {
      allowed: true,
      remaining: rule.limit - current.length,
      retryAfterSeconds: 0,
    };
  }
  // Bloqueado hasta que el fallo más antiguo salga de la ventana.
  const freesUpAt = current[0] + rule.windowMs;
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((freesUpAt - now) / 1000)),
  };
}

/** Apunta un intento fallido y devuelve el estado resultante. */
export function consumeAttempt(
  key: string,
  rule: RateLimitRule,
  now: number = Date.now(),
): RateLimitResult {
  const current = prune(failures.get(key) ?? [], now, rule.windowMs);
  current.push(now);
  touch(key, current);

  if (current.length < rule.limit) {
    return {
      allowed: true,
      remaining: rule.limit - current.length,
      retryAfterSeconds: 0,
    };
  }
  const freesUpAt = current[0] + rule.windowMs;
  return {
    allowed: false,
    remaining: 0,
    retryAfterSeconds: Math.max(1, Math.ceil((freesUpAt - now) / 1000)),
  };
}

/** Borra el contador de una clave: se llama cuando el intento sale bien. */
export function resetAttempts(key: string): void {
  failures.delete(key);
}

/** Solo para los tests: deja el limitador como recién arrancado. */
export function resetAllAttempts(): void {
  failures.clear();
}

/**
 * IP del cliente según las cabeceras del proxy. En Vercel siempre llegan; en
 * local no, y entonces todas las peticiones comparten la clave "unknown", que
 * es justo lo que queremos (un único cupo) en vez de no limitar nada.
 */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // Puede venir como "cliente, proxy1, proxy2": el primero es el cliente.
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
