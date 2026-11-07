import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { exchangeCodeForTokens, getGoogleUserEmail } from "@/lib/google-calendar/client";
import { saveWorkspaceGoogleCalendarTokens, GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/integrations/google-calendar-config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE);

  const redirectBack = (status: "connected" | "error") =>
    NextResponse.redirect(`${url.origin}/integraciones?google_calendar=${status}`);

  if (error || !code || !state || state !== expectedState) return redirectBack("error");

  const ctx = await getActiveWorkspace();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));

  try {
    const redirectUri = `${url.origin}/api/oauth/google-calendar/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    if (!tokens.refresh_token) {
      // Google solo manda refresh_token en el primer consentimiento (o cuando se fuerza
      // prompt=consent, que ya hacemos) — sin él no podemos mantener la conexión viva.
      return redirectBack("error");
    }
    const email = await getGoogleUserEmail(tokens.access_token);
    await saveWorkspaceGoogleCalendarTokens(ctx.workspace.id, {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      email: email ?? "",
    });
    return redirectBack("connected");
  } catch {
    return redirectBack("error");
  }
}
