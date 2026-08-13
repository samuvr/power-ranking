import Link from "next/link";
import { notFound } from "next/navigation";
import { getVotingPublic } from "@/lib/db/client";
import { VotingSettingsForm } from "@/components/VotingSettingsForm";

export const dynamic = "force-dynamic";

export default async function VotingSettingsPage() {
  const voting = await getVotingPublic();
  if (!voting) notFound();

  return (
    <main className="mx-auto w-full max-w-xl px-5 py-8">
      <header className="mb-6">
        <Link href="/admin" className="text-xs text-muted hover:underline">
          ← Volver
        </Link>
        <h1 className="mt-2 text-3xl font-black">Ajustes de la votación</h1>
        <p className="mt-1 text-sm text-muted">
          Identidad visual, acceso y contraseña de {voting.name}.
        </p>
      </header>
      <VotingSettingsForm voting={voting} />
    </main>
  );
}
