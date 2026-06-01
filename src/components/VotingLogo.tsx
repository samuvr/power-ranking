"use client";

import { useState } from "react";

type Props = {
  src: string;
  name: string;
  // Color de acento de la votación; se usa como fondo del placeholder.
  accent: string;
  className?: string;
  // Tamaño del texto de la inicial cuando se muestra el placeholder.
  fallbackTextClassName?: string;
};

// Muestra el logo de la votación y, si la imagen no carga (URL rota, host que
// bloquea el hotlinking, etc.), cae a un placeholder con la inicial de la
// votación sobre su color de acento en lugar del icono de imagen rota.
export function VotingLogo({
  src,
  name,
  accent,
  className,
  fallbackTextClassName,
}: Props) {
  const [failed, setFailed] = useState(false);
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  if (failed || !src) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center font-bold text-white ${
          fallbackTextClassName ?? "text-lg"
        }`}
        style={{ background: accent }}
        aria-label={`Logo ${name}`}
      >
        {initial}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={`Logo ${name}`}
      className={className ?? "h-full w-full object-cover"}
      onError={() => setFailed(true)}
    />
  );
}
