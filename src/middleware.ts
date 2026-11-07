import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth/session";

// Rutas que se autentican por su propio esquema o son públicas por diseño:
// - webhooks de canales externos (Evolution, Meta…) y cron jobs (CRON_SECRET)
// - /api/files: archivos públicos (fotos de propiedades, PDFs compartidos por enlace)
// - catálogo público por inmobiliaria
// - páginas legales (requisito de Meta App Review)
const PUBLIC_PREFIXES = ["/api/webhooks/", "/api/jobs/", "/api/files/", "/catalogo/", "/legal/"];
const AUTH_PREFIXES = ["/login", "/register", "/forgot-password", "/reset-password"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const userId = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  const isAuthRoute = AUTH_PREFIXES.some((p) => pathname.startsWith(p));

  if (!userId && !isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Con sesión → no mostrar login/registro (reset-password sí es accesible: es el flujo de invitación).
  if (userId && isAuthRoute && !pathname.startsWith("/reset-password")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
