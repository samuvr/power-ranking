import { getVotingPublic } from "@/lib/db/client";
import { VotingLogo } from "@/components/VotingLogo";
import { HomeForm } from "./HomeForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const voting = await getVotingPublic();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <header className="mb-8 text-center">
        <div className="mb-5 flex justify-center">
          <div
            className="relative h-24 w-24 overflow-hidden rounded-full border-2"
            style={{ borderColor: "var(--foreground)" }}
          >
            <VotingLogo
              src={voting?.logo_url ?? "/nfl-alicante.jpg"}
              name={voting?.name ?? "NFL Alicante"}
              accent={voting?.accent ?? "#D81E2C"}
              fallbackTextClassName="text-3xl"
            />
          </div>
        </div>
        <p className="font-subhead text-xs uppercase tracking-[0.25em] text-muted">
          Temporada 2026
        </p>
        <h1 className="mt-2 font-display text-6xl uppercase leading-[0.95]">Power Ranking</h1>
        <p className="mt-2 font-subhead text-sm">
          Un proyecto de {voting?.name ?? "NFL Alicante"}
        </p>
        <p className="mt-3 text-sm text-muted">
          Ordena los 32 equipos y ayuda a crear el ranking global de tu comunidad.
        </p>
      </header>

      {voting && voting.active ? (
        <HomeForm publicAccess={voting.public_access} />
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-surface p-5 text-center text-sm text-muted">
          La votación está cerrada ahora mismo.
        </p>
      )}

      <footer className="mt-10 text-center text-xs text-muted">
        <p>Reenviar con el mismo email sobrescribe tu ranking anterior.</p>
        <div className="mt-5 flex justify-center gap-5">
          <a
            href="https://x.com/nfl_alicante"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="NFL Alicante en X"
            className="text-foreground transition-opacity hover:opacity-70"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
            </svg>
          </a>
          <a
            href="https://www.instagram.com/nfl_alicante"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="NFL Alicante en Instagram"
            className="text-foreground transition-opacity hover:opacity-70"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069ZM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0Zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324ZM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8Zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881Z" />
            </svg>
          </a>
        </div>
      </footer>
    </main>
  );
}
