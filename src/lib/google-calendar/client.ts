import {
  getWorkspaceGoogleCalendarTokens,
  updateWorkspaceGoogleCalendarAccessToken,
} from "@/lib/integrations/google-calendar-config";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type TokenResponse = { access_token: string; refresh_token?: string; expires_in: number };

export async function exchangeCodeForTokens(code: string, redirectUri: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${await res.text()}`);
  return res.json();
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${await res.text()}`);
  return res.json();
}

export async function getGoogleUserEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { email?: string };
  return data.email ?? null;
}

/** Devuelve un access token vigente, refrescándolo si venció. Null si el workspace no tiene la integración activa. */
export async function getValidAccessToken(workspaceId: string): Promise<string | null> {
  const tokens = await getWorkspaceGoogleCalendarTokens(workspaceId);
  if (!tokens) return null;

  const isExpiringSoon = tokens.expiresAt.getTime() - Date.now() < 60_000;
  if (!isExpiringSoon) return tokens.accessToken;

  const refreshed = await refreshAccessToken(tokens.refreshToken);
  const expiresAt = new Date(Date.now() + refreshed.expires_in * 1000);
  await updateWorkspaceGoogleCalendarAccessToken(workspaceId, refreshed.access_token, expiresAt);
  return refreshed.access_token;
}

export type CalendarEventInput = {
  title: string;
  description?: string | null;
  startAt: Date;
  endAt: Date;
  location?: string | null;
  timeZone?: string;
};

function toGoogleEventBody(event: CalendarEventInput) {
  const timeZone = event.timeZone ?? "America/Santo_Domingo";
  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: { dateTime: event.startAt.toISOString(), timeZone },
    end: { dateTime: event.endAt.toISOString(), timeZone },
  };
}

export async function createCalendarEvent(accessToken: string, event: CalendarEventInput): Promise<string> {
  const res = await fetch(`${CALENDAR_API}/calendars/primary/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(toGoogleEventBody(event)),
  });
  if (!res.ok) throw new Error(`Google Calendar createEvent failed: ${await res.text()}`);
  const data = (await res.json()) as { id: string };
  return data.id;
}

export async function updateCalendarEvent(accessToken: string, eventId: string, event: CalendarEventInput): Promise<void> {
  const res = await fetch(`${CALENDAR_API}/calendars/primary/events/${eventId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(toGoogleEventBody(event)),
  });
  if (!res.ok) throw new Error(`Google Calendar updateEvent failed: ${await res.text()}`);
}

export async function deleteCalendarEvent(accessToken: string, eventId: string): Promise<void> {
  const res = await fetch(`${CALENDAR_API}/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  // 404/410 = ya no existe del lado de Google (borrado a mano ahí) — no es un fallo desde nuestra perspectiva.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar deleteEvent failed: ${await res.text()}`);
  }
}
