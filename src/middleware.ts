import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_COOKIE_NAME, USER_COOKIE_NAME } from "@/lib/cookie-names";

export const config = {
  matcher: [
    "/",
    "/vote/:path*",
    "/consenso",
    "/historico/:path*",
    "/equipos/:path*",
    "/perfil",
    "/admin/:path*",
    "/api/admin/:path*",
  ],
};

function secretKey(): Uint8Array | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

async function hasRole(
  request: NextRequest,
  cookieName: string,
  role: string,
): Promise<boolean> {
  const key = secretKey();
  if (!key) return false;
  const token = request.cookies.get(cookieName)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, key);
    return payload.role === role;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // La home es login/registro: con sesión abierta se va directo al ranking.
  if (pathname === "/") {
    if (await hasRole(request, USER_COOKIE_NAME, "user")) {
      const url = request.nextUrl.clone();
      url.pathname = "/vote";
      url.search = "";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Zona de usuario registrado. El admin también puede entrar para revisar.
  if (
    pathname.startsWith("/vote") ||
    pathname === "/consenso" ||
    pathname.startsWith("/historico") ||
    pathname.startsWith("/equipos") ||
    pathname === "/perfil"
  ) {
    if (await hasRole(request, USER_COOKIE_NAME, "user")) return NextResponse.next();
    if (await hasRole(request, ADMIN_COOKIE_NAME, "admin")) return NextResponse.next();
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // /admin muestra el propio formulario de login; el resto del panel y todas
  // las APIs admin (salvo el login) requieren sesión de administrador.
  const isLoginPage = pathname === "/admin";
  const isLoginApi = pathname === "/api/admin/login";
  if (isLoginPage || isLoginApi) {
    return NextResponse.next();
  }

  if (await hasRole(request, ADMIN_COOKIE_NAME, "admin")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/admin")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.clone();
  url.pathname = "/admin";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}
