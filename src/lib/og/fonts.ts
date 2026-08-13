export type FontEntry = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 700;
  style: "normal";
};

export type FontNames = {
  display: string;
  subhead: string;
  mono: string;
};

/**
 * Descarga una Google Font como TTF. Usamos User-Agent IE6 para forzar TTF
 * (Satori no soporta WOFF2). Cacheado en build.
 */
export async function loadGoogleFont(
  family: string,
  weight = 400,
): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`;
    const cssRes = await fetch(cssUrl, {
      headers: { "User-Agent": "Mozilla/4.0 (compatible; MSIE 6.0; Windows NT 5.1)" },
      cache: "force-cache",
    });
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src:\s*url\(([^)]+)\)\s*format\(['"](?:truetype|opentype)['"]\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1], { cache: "force-cache" });
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export async function loadAllFonts(): Promise<FontEntry[]> {
  const [anton, archivo, inter400, inter700, mono] = await Promise.all([
    loadGoogleFont("Anton", 400),
    loadGoogleFont("Archivo Black", 400),
    loadGoogleFont("Inter", 400),
    loadGoogleFont("Inter", 700),
    loadGoogleFont("JetBrains Mono", 400),
  ]);
  const out: FontEntry[] = [];
  if (anton) out.push({ name: "Anton", data: anton, weight: 400, style: "normal" });
  if (archivo) out.push({ name: "ArchivoBlack", data: archivo, weight: 400, style: "normal" });
  if (inter400) out.push({ name: "Inter", data: inter400, weight: 400, style: "normal" });
  if (inter700) out.push({ name: "Inter", data: inter700, weight: 700, style: "normal" });
  if (mono) out.push({ name: "JetBrainsMono", data: mono, weight: 400, style: "normal" });
  return out;
}

export function resolveFontNames(fonts: FontEntry[]): FontNames {
  return {
    display: fonts.some((f) => f.name === "Anton") ? "Anton" : "Inter",
    subhead: fonts.some((f) => f.name === "ArchivoBlack") ? "ArchivoBlack" : "Inter",
    mono: fonts.some((f) => f.name === "JetBrainsMono") ? "JetBrainsMono" : "Inter",
  };
}

export function getOrigin(req: Request): string {
  try {
    const u = new URL(req.url);
    if (u.protocol && u.host) return `${u.protocol}//${u.host}`;
  } catch {
    /* ignore */
  }
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function absoluteLogoUrl(logoUrl: string, origin: string): string {
  return logoUrl.startsWith("http") ? logoUrl : `${origin}${logoUrl}`;
}
