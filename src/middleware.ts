import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { ADMIN_COOKIE_NAME } from "@/lib/auth";

export const config = {
  matcher: ["/", "/admin/:path*", "/api/admin/:path*"],
};

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return false;
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload.role === "admin";
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Al entrar a la home, limpiamos el acceso previo de votante (y cualquier
  // cookie legacy de admin de votación) para que la contraseña se pida de
  // nuevo cada vez que arranca el flujo.
  if (pathname === "/") {
    const response = NextResponse.next();
    for (const cookie of request.cookies.getAll()) {
      if (
        cookie.name.startsWith("voter_access_") ||
        cookie.name.startsWith("voting_admin_")
      ) {
        response.cookies.delete(cookie.name);
      }
    }
    return response;
  }

  // /admin muestra el propio formulario de login; el resto del panel y todas
  // las APIs admin (salvo el login) requieren sesión de administrador.
  const isLoginPage = pathname === "/admin";
  const isLoginApi = pathname === "/api/admin/login";
  if (isLoginPage || isLoginApi) {
    return NextResponse.next();
  }

  if (await isAuthenticated(request)) {
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
