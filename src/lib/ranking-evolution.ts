/**
 * Evolución de un ranking respecto a una foto anterior (screenshot).
 *
 * Puro, sin IO: recibe dos listas ordenadas de `abbr` (posición 1 = mejor).
 * `delta` positivo = el equipo ha SUBIDO puestos (flecha verde), negativo =
 * ha bajado (roja), 0 = se mantiene ("="). `null` = no hay dato anterior con
 * el que comparar y no se pinta nada.
 */

export type Evolution = {
  teamAbbr: string;
  position: number;
  previousPosition: number | null;
  delta: number | null;
};

export function computeEvolution(
  current: string[],
  previous: string[] | null | undefined,
): Evolution[] {
  const previousPosByTeam = new Map<string, number>();
  if (previous) {
    previous.forEach((teamAbbr, idx) => previousPosByTeam.set(teamAbbr, idx + 1));
  }

  return current.map((teamAbbr, idx) => {
    const position = idx + 1;
    const previousPosition = previousPosByTeam.get(teamAbbr) ?? null;
    return {
      teamAbbr,
      position,
      previousPosition,
      // Subir de la 10 a la 4 son +6 puestos.
      delta: previousPosition === null ? null : previousPosition - position,
    };
  });
}

export function evolutionByTeam(evolutions: Evolution[]): Map<string, Evolution> {
  return new Map(evolutions.map((e) => [e.teamAbbr, e]));
}

/**
 * Los que más suben y los que más bajan, para el "Movers of the week".
 * Empates: primero el que acaba en mejor puesto.
 */
export function topMovers(
  evolutions: Evolution[],
  n = 3,
): { risers: Evolution[]; fallers: Evolution[] } {
  const withDelta = evolutions.filter(
    (e): e is Evolution & { delta: number } => e.delta !== null,
  );
  const risers = withDelta
    .filter((e) => e.delta > 0)
    .sort((a, b) => b.delta - a.delta || a.position - b.position)
    .slice(0, n);
  const fallers = withDelta
    .filter((e) => e.delta < 0)
    .sort((a, b) => a.delta - b.delta || a.position - b.position)
    .slice(0, n);
  return { risers, fallers };
}

/**
 * Serie temporal del puesto de un equipo a lo largo de los screenshots.
 * `snapshots` llega del más antiguo al más reciente; un equipo ausente en un
 * screenshot (no debería pasar con los 32 fijos) se omite.
 */
export function teamPositionHistory(
  snapshots: Array<{ id: string; name: string; createdAt: string; consensus: string[] }>,
  teamAbbr: string,
): Array<{ id: string; name: string; createdAt: string; position: number }> {
  const out: Array<{ id: string; name: string; createdAt: string; position: number }> = [];
  for (const snap of snapshots) {
    const idx = snap.consensus.indexOf(teamAbbr);
    if (idx === -1) continue;
    out.push({
      id: snap.id,
      name: snap.name,
      createdAt: snap.createdAt,
      position: idx + 1,
    });
  }
  return out;
}
