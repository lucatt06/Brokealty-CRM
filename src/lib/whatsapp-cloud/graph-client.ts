const GRAPH_BASE_URL = "https://graph.facebook.com/v21.0";

async function graphFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${GRAPH_BASE_URL}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`WhatsApp Cloud API ${path} -> ${res.status}: ${body}`);
  }
  return res.json();
}

/**
 * Intercambia el código de autorización que devuelve el popup de Embedded Signup
 * por un access token. Si Meta lo entrega de corta duración (poco común en
 * Embedded Signup, que normalmente ya da uno de larga duración), se hace un
 * segundo intercambio por uno de larga duración (~60 días).
 */
export async function exchangeCodeForToken(code: string): Promise<{ accessToken: string; expiresIn: number | null }> {
  const clientId = process.env.NEXT_PUBLIC_META_APP_ID ?? "";
  const clientSecret = process.env.META_APP_SECRET ?? "";
  const params = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code });
  const result = (await graphFetch(`/oauth/access_token?${params}`)) as { access_token: string; expires_in?: number };

  // expires_in ausente o mayor a un día ya es de larga duración; si no, se intercambia.
  if (!result.expires_in || result.expires_in > 86_400) {
    return { accessToken: result.access_token, expiresIn: result.expires_in ?? null };
  }

  const longLivedParams = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: result.access_token,
  });
  const longLived = (await graphFetch(`/oauth/access_token?${longLivedParams}`)) as { access_token: string; expires_in?: number };
  return { accessToken: longLived.access_token, expiresIn: longLived.expires_in ?? null };
}

/** Suscribe nuestra App a los webhooks de esta WABA — sin esto Meta no nos manda mensajes. */
export async function subscribeAppToWaba(wabaId: string, accessToken: string) {
  return graphFetch(`/${wabaId}/subscribed_apps`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/** Registra el número para mensajería vía Cloud API (requiere un PIN de 2 pasos, aunque no se use 2FA real). */
export async function registerPhoneNumber(phoneNumberId: string, accessToken: string, pin: string) {
  return graphFetch(`/${phoneNumberId}/register`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", pin }),
  });
}

export async function getPhoneNumberInfo(phoneNumberId: string, accessToken: string) {
  return graphFetch(`/${phoneNumberId}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }) as Promise<{ display_phone_number?: string; verified_name?: string }>;
}

export async function getMediaUrl(mediaId: string, accessToken: string) {
  return graphFetch(`/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  }) as Promise<{ url?: string; mime_type?: string }>;
}

/** Descarga el binario de un adjunto — a diferencia de Evolution, Cloud API separa "obtener URL" de "descargar". */
export async function downloadMedia(url: string, accessToken: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`No se pudo descargar el adjunto de WhatsApp Cloud API: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

export async function sendTextMessage(phoneNumberId: string, accessToken: string, to: string, text: string) {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text } }),
  }) as Promise<{ messages?: { id: string }[] }>;
}

/**
 * Envía una respuesta por WhatsApp Cloud API. A diferencia de sendWhatsAppReply de
 * Evolution, no hay simulación de "escribiendo…" — Cloud API no expone presence.
 */
export async function sendWhatsAppCloudReply(params: { phoneNumberId: string; accessToken: string; to: string; text: string }) {
  const { phoneNumberId, accessToken, to, text } = params;
  return sendTextMessage(phoneNumberId, accessToken, to, text);
}

/** Envía una imagen por URL — la URL debe ser pública, Meta la descarga desde sus servidores. */
export async function sendImageMessage(phoneNumberId: string, accessToken: string, to: string, imageUrl: string, caption?: string) {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "image",
      image: { link: imageUrl, ...(caption ? { caption } : {}) },
    }),
  }) as Promise<{ messages?: { id: string }[] }>;
}

export async function sendLocationMessage(
  phoneNumberId: string, accessToken: string, to: string,
  loc: { latitude: number; longitude: number; name: string; address: string }
) {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "location", location: loc }),
  }) as Promise<{ messages?: { id: string }[] }>;
}

/** `emoji` vacío quita la reacción. */
export async function sendReactionMessage(phoneNumberId: string, accessToken: string, to: string, messageId: string, emoji: string) {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "reaction", reaction: { message_id: messageId, emoji } }),
  }) as Promise<{ messages?: { id: string }[] }>;
}

export async function markMessageRead(phoneNumberId: string, accessToken: string, messageId: string) {
  return graphFetch(`/${phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
  });
}
