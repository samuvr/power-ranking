/**
 * Qué rankings entran en el consenso "en vivo".
 *
 * Regla del panel: el consenso solo se calcula con los rankings guardados
 * **después** del último screenshot. Los que no se han tocado desde entonces
 * ya están congelados en ese screenshot y se quedan fuera; solo vuelven a
 * contar si, al crear el siguiente screenshot, se marca la opción de incluir
 * también los rankings anteriores (`includeAll`).
 *
 * Puro: sin DB ni IO, para poder testearlo con arrays.
 */

export type DateLike = string | Date;

/** Milisegundos de una fecha, o `null` si no hay fecha o no se puede leer. */
function toTime(value: DateLike | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Corte a partir del cual un ranking se considera actualizado: la fecha de
 * creación del último screenshot. `null` cuando todavía no hay ninguno, y
 * entonces todos los rankings cuentan como nuevos.
 */
export function snapshotCutoff(
  snapshot: { created_at: DateLike } | null | undefined,
): number | null {
  return snapshot ? toTime(snapshot.created_at) : null;
}

/** Si un ranking se guardó después del corte (sin corte, siempre sí). */
export function isUpdatedAfter(updatedAt: DateLike, cutoff: number | null): boolean {
  if (cutoff === null) return true;
  const ms = toTime(updatedAt);
  return ms !== null && ms > cutoff;
}

/**
 * Los rankings que entran en el consenso en vivo: los guardados después del
 * corte. Sin corte devuelve la lista entera (mismo array de entrada).
 */
export function rankingsUpdatedAfter<T extends { updated_at: DateLike }>(
  rows: T[],
  cutoff: number | null,
): T[] {
  if (cutoff === null) return rows;
  return rows.filter((row) => isUpdatedAfter(row.updated_at, cutoff));
}
