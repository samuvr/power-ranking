import { notFound, redirect } from "next/navigation";
import { getVotingBySlug } from "@/lib/db/client";
import { hasVoterAccess } from "@/lib/voting-access";
import { isAdminAuthenticated } from "@/lib/auth";
import { VoterLoginForm } from "./VoterLoginForm";

type Params = Promise<{ voting: string }>;

export const dynamic = "force-dynamic";

export default async function VoterAccessPage({ params }: { params: Params }) {
  const { voting: slug } = await params;
  const voting = await getVotingBySlug(slug);
  if (!voting || !voting.active) notFound();

  if (await isAdminAuthenticated()) {
    redirect(`/vote/${slug}`);
  }
  if (await hasVoterAccess(voting.id)) {
    redirect(`/vote/${slug}`);
  }

  const isPublic = voting.public_access;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-5 py-10">
      <header className="mb-6 text-center">
        <p
          className="text-xs font-bold uppercase tracking-[0.2em]"
          style={{ color: voting.accent }}
        >
          {voting.name}
        </p>
        <h1 className="mt-1 text-3xl font-black">Acceso votante</h1>
        <p className="mt-2 text-sm text-muted">
          {isPublic
            ? `Ordena los QBs como prefieras y pulsa "Enviar Ranking". No es necesario que compartas la captura de pantalla con ${voting.name}, tu ranking quedará guardado automáticamente en la base de datos.`
            : "Introduce la contraseña para empezar a votar."}
        </p>
      </header>
      <VoterLoginForm slug={voting.slug} isPublic={isPublic} />
    </main>
  );
}
