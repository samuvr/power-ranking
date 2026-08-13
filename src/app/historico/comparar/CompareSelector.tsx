"use client";

import { useRouter } from "next/navigation";

type Option = { id: string; name: string };

type Props = { options: Option[]; a: string; b: string };

export function CompareSelector({ options, a, b }: Props) {
  const router = useRouter();

  const go = (nextA: string, nextB: string) => {
    router.push(`/historico/comparar?a=${nextA}&b=${nextB}`);
  };

  return (
    <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
          Desde
        </span>
        <select
          value={a}
          onChange={(e) => go(e.target.value, b)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="font-subhead mb-1 block text-[11px] uppercase tracking-wide text-muted">
          Hasta
        </span>
        <select
          value={b}
          onChange={(e) => go(a, e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-foreground"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
