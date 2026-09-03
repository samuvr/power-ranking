/**
 * "Mi temporada": el recorrido del ranking de un votante a lo largo de los
 * screenshots en los que participó, cerrado con lo que tiene guardado ahora.
 *
 * Mientras `/equipos/[abbr]` cuenta la historia de un equipo dentro del
 * consensus, esto cuenta la de una persona: a quién subió al podio, a quién
 * echó y cuánto ha cambiado de opinión desde su primer voto.
 *
 * Puro, sin IO: recibe listas ordenadas de `abbr` (posición 1 = mejor).
 */

export type SeasonPoint = {
  /** Id del screenshot, o `null` para el ranking vivo ("Ahora"). */
  id: string | null;
  label: string;
  positions: string[];
};

export type SeasonSlice = SeasonPoint & {
  /** Los `size` primeros de ese momento. */
  top: string[];
  /** Equipos que entran en el top respecto al punto anterior. */
  entered: string[];
  /** Equipos que estaban en el top y se caen. */
  left: string[];
};

/**
 * Marca en cada punto quién entra y quién sale del top. El primer punto no
 * tiene con qué compararse: `entered` y `left` van vacíos, no "todos entran".
 *
 * `points` llega en orden cronológico (el más antiguo primero).
 */
export function seasonTopSlices(
  points: readonly SeasonPoint[],
  size = 5,
): SeasonSlice[] {
  let previousTop: Set<string> | null = null;

  return points.map((point) => {
    const top = point.positions.slice(0, size);
    const currentTop = new Set(top);

    const entered = previousTop === null ? [] : top.filter((abbr) => !previousTop!.has(abbr));
    const left =
      previousTop === null ? [] : [...previousTop].filter((abbr) => !currentTop.has(abbr));

    previousTop = currentTop;
    return { ...point, top, entered, left };
  });
}

export type SeasonChange = {
  teamAbbr: string;
  firstPosition: number;
  lastPosition: number;
  /** Positivo = ha subido desde el primer voto. */
  delta: number;
};

/**
 * Cuánto ha cambiado de opinión sobre cada equipo entre su primer punto y el
 * último. Devuelve la lista completa ordenada por movimiento (los que más
 * suben primero); los equipos que no estaban en ambos extremos se omiten.
 */
export function seasonChanges(points: readonly SeasonPoint[]): SeasonChange[] {
  if (points.length < 2) return [];

  const first = points[0].positions;
  const last = points[points.length - 1].positions;
  const firstPosByTeam = new Map(first.map((abbr, idx) => [abbr, idx + 1]));

  const changes: SeasonChange[] = [];
  last.forEach((teamAbbr, idx) => {
    const firstPosition = firstPosByTeam.get(teamAbbr);
    if (firstPosition === undefined) return;
    const lastPosition = idx + 1;
    changes.push({
      teamAbbr,
      firstPosition,
      lastPosition,
      delta: firstPosition - lastPosition,
    });
  });

  // Empates: primero el que acaba mejor colocado.
  return changes.sort((a, b) => b.delta - a.delta || a.lastPosition - b.lastPosition);
}

/** Los `count` que más han subido y los `count` que más han bajado. */
export function seasonBiggestChanges(
  changes: readonly SeasonChange[],
  count = 3,
): { risers: SeasonChange[]; fallers: SeasonChange[] } {
  const n = Math.max(0, count);
  return {
    risers: changes.filter((c) => c.delta > 0).slice(0, n),
    fallers: [...changes]
      .filter((c) => c.delta < 0)
      .sort((a, b) => a.delta - b.delta || a.lastPosition - b.lastPosition)
      .slice(0, n),
  };
}
