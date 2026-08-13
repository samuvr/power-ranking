export const EVOLUTION_UP = "#16a34a";
export const EVOLUTION_DOWN = "#dc2626";

type Props = {
  /** Puestos ganados respecto a la foto anterior. null = sin dato previo. */
  delta: number | null;
  /** Nombre del screenshot con el que se compara, para el tooltip. */
  since?: string;
  size?: "sm" | "md";
};

/**
 * Flecha verde con los puestos que sube, roja con los que baja, "=" gris si
 * se mantiene. Sin dato anterior no se pinta nada.
 */
export function EvolutionBadge({ delta, since, size = "md" }: Props) {
  if (delta === null) return null;

  const base =
    size === "sm"
      ? "min-w-9 justify-center rounded-md border px-1 py-0.5 font-mono text-[10px] font-bold"
      : "min-w-11 justify-center rounded-md border px-1.5 py-1 font-mono text-[11px] font-bold";
  const suffix = since ? ` desde ${since}` : "";

  if (delta === 0) {
    return (
      <span
        className={`flex shrink-0 border-border text-muted ${base}`}
        title={`Se mantiene${suffix}`}
        aria-label={`Se mantiene${suffix}`}
      >
        =
      </span>
    );
  }

  const up = delta > 0;
  const color = up ? EVOLUTION_UP : EVOLUTION_DOWN;
  const puestos = Math.abs(delta) === 1 ? "puesto" : "puestos";
  const label = `${up ? "Sube" : "Baja"} ${Math.abs(delta)} ${puestos}${suffix}`;

  return (
    <span
      className={`flex shrink-0 ${base}`}
      style={{ borderColor: color, color }}
      title={label}
      aria-label={label}
    >
      {up ? "▲" : "▼"}
      {Math.abs(delta)}
    </span>
  );
}
