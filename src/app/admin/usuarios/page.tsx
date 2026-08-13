import Link from "next/link";
import { notFound } from "next/navigation";
import { getVoting, listUsers } from "@/lib/db/client";
import { UsersView } from "./UsersView";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const voting = await getVoting();
  if (!voting) notFound();

  const users = await listUsers(voting.id);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p
            className="font-subhead text-xs uppercase tracking-[0.25em]"
            style={{ color: voting.accent }}
          >
            Comunidad
          </p>
          <h1 className="font-display text-4xl uppercase leading-tight">Usuarios</h1>
          <p className="mt-1 text-sm text-muted">
            {users.length} cuentas. No hay envío de emails: si alguien pierde su
            contraseña, genérale una temporal y que la cambie en su perfil.
          </p>
        </div>
        <Link
          href="/admin"
          className="font-subhead rounded-xl border border-border bg-surface px-3 py-2 text-xs uppercase tracking-wide transition hover:border-foreground"
        >
          ← Panel
        </Link>
      </header>

      <UsersView
        users={users.map((u) => ({
          id: u.id,
          fullName: u.full_name,
          email: u.email,
          rankingUpdatedAt: u.ranking_updated_at
            ? new Date(u.ranking_updated_at).toISOString()
            : null,
          snapshotCount: u.snapshot_count,
        }))}
      />
    </main>
  );
}
