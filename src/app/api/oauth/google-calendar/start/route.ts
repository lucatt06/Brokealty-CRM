import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getActiveWorkspace } from "@/lib/auth/active-workspace";
import { GOOGLE_OAUTH_STATE_COOKIE } from "@/lib/integrations/google-calendar-config";

export async function GET(request: Request) {
  const ctx = await getActiveWorkspace();
  if (!ctx) return NextResponse.redirect(new URL("/login", request.url));

  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });

  const redirectUri = `${new URL(request.url).origin}/api/oauth/google-calendar/callback`;
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
