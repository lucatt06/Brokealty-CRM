"use server";

import { putFile } from "@/lib/storage/blob";
import { requireCtx } from "@/lib/auth/guards";
import { UnsafeUrlError, assertPublicHttpUrl, readTextCapped, safeFetch } from "@/lib/net/safe-fetch";

const PHOTOS_BUCKET = "property-photos";
const MAX_PHOTO_SIZE = 8 * 1024 * 1024; // 8MB
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

const VOICE_BUCKET = "voice-notes";
const MAX_VOICE_SIZE = 15 * 1024 * 1024; // 15MB (~15 min de audio comprimido)

const KB_BUCKET = "knowledge-base";
const MAX_KB_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_KB_TYPES = ["application/pdf", "text/plain", "text/csv",
  "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
const ALLOWED_KB_TABLE_TYPES = ["text/csv", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];

const CHAT_BUCKET = "chat-attachments";
const MAX_CHAT_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_CHAT_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "application/pdf"];

const OPERATION_DOCS_BUCKET = "operation-documents-files";
const MAX_OPERATION_DOC_SIZE = 15 * 1024 * 1024; // 15MB
const ALLOWED_OPERATION_DOC_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "application/pdf"];

type Result = { url: string; error?: undefined } | { url?: undefined; error: string };

// ── Subida de archivo directo desde el dispositivo ────────
export async function uploadPropertyPhotoFile(formData: FormData): Promise<Result> {
  await requireCtx();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió ningún archivo." };
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return { error: "Formato no soportado. Usa JPG, PNG, WEBP o GIF." };
  if (file.size > MAX_PHOTO_SIZE) return { error: "La imagen supera el límite de 8MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return { url: await putFile(PHOTOS_BUCKET, buffer, file.type, ext) };
  } catch (e) {
    console.error("[storage] fallo de subida:", e);
    return { error: "No se pudo subir la imagen. Intenta de nuevo." };
  }
}

// ── Subida de adjunto para el chat de prueba del bot (imagen/PDF) ─
export async function uploadChatAttachment(formData: FormData): Promise<Result> {
  await requireCtx();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió ningún archivo." };
  if (!ALLOWED_CHAT_TYPES.includes(file.type)) return { error: "Formato no soportado. Usa JPG, PNG, WEBP, GIF o PDF." };
  if (file.size > MAX_CHAT_ATTACHMENT_SIZE) return { error: "El archivo supera el límite de 10MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return { url: await putFile(CHAT_BUCKET, buffer, file.type, ext) };
  } catch (e) {
    console.error("[storage] fallo de subida:", e);
    return { error: "No se pudo subir el archivo. Intenta de nuevo." };
  }
}

// ── Subida de nota de voz grabada en el navegador ─────────
export async function uploadVoiceNote(formData: FormData): Promise<Result> {
  await requireCtx();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió ningún audio." };
  if (!file.type.startsWith("audio/")) return { error: "Formato de audio no soportado." };
  if (file.size > MAX_VOICE_SIZE) return { error: "La nota de voz es demasiado larga." };

  const ext = file.type.includes("webm") ? "webm" : file.type.includes("ogg") ? "ogg" : file.type.includes("wav") ? "wav" : "m4a";
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return { url: await putFile(VOICE_BUCKET, buffer, file.type || "audio/webm", ext) };
  } catch (e) {
    console.error("[storage] fallo de subida:", e);
    return { error: "No se pudo subir la nota de voz. Intenta de nuevo." };
  }
}

// ── Subida de archivo para la base de conocimiento del bot ─
export async function uploadKnowledgeFile(formData: FormData): Promise<Result> {
  await requireCtx();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió ningún archivo." };
  if (!ALLOWED_KB_TYPES.includes(file.type)) return { error: "Formato no soportado. Usa PDF, DOC, DOCX, TXT o CSV." };
  if (file.size > MAX_KB_SIZE) return { error: "El archivo supera el límite de 20MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return { url: await putFile(KB_BUCKET, buffer, file.type, ext) };
  } catch (e) {
    console.error("[storage] fallo de subida:", e);
    return { error: "No se pudo subir el archivo. Intenta de nuevo." };
  }
}

// ── Subida de tabla (CSV/XLSX) para la base de conocimiento ─
export async function uploadKnowledgeTable(formData: FormData): Promise<Result> {
  await requireCtx();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió ningún archivo." };
  if (!ALLOWED_KB_TABLE_TYPES.includes(file.type)) return { error: "Formato no soportado. Usa CSV o XLSX." };
  if (file.size > MAX_KB_SIZE) return { error: "El archivo supera el límite de 20MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || "csv";
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return { url: await putFile(KB_BUCKET, buffer, file.type, ext) };
  } catch (e) {
    console.error("[storage] fallo de subida:", e);
    return { error: "No se pudo subir la tabla. Intenta de nuevo." };
  }
}

// ── Subida de documento operativo (cédula, comprobante, etc. — Fase 2B) ─
export async function uploadOperationDocumentFile(formData: FormData): Promise<Result> {
  await requireCtx();
  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "No se recibió ningún archivo." };
  if (!ALLOWED_OPERATION_DOC_TYPES.includes(file.type)) return { error: "Formato no soportado. Usa JPG, PNG, WEBP o PDF." };
  if (file.size > MAX_OPERATION_DOC_SIZE) return { error: "El archivo supera el límite de 15MB." };

  const ext = file.name.split(".").pop()?.toLowerCase() || (file.type === "application/pdf" ? "pdf" : "jpg");
  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    return { url: await putFile(OPERATION_DOCS_BUCKET, buffer, file.type, ext) };
  } catch (e) {
    console.error("[storage] fallo de subida:", e);
    return { error: "No se pudo subir el documento. Intenta de nuevo." };
  }
}

// ── Resolución de foto a partir de un enlace ──────────────
// Acepta tanto una URL de imagen directa como el enlace de un anuncio
// (Supercarros, Encuentra24, Facebook Marketplace, etc.) — en ese caso
// extrae la imagen principal (og:image) de la página.
export async function resolvePhotoUrl(inputUrl: string): Promise<Result> {
  await requireCtx();
  let parsed: URL;
  let res: Response;
  try {
    parsed = await assertPublicHttpUrl(inputUrl.trim());
    res = await safeFetch(parsed.toString(), { headers: { "User-Agent": "Mozilla/5.0 (compatible; BrokealtyBot/1.0)" } });
  } catch (e) {
    if (e instanceof UnsafeUrlError) return { error: e.message };
    console.error("[storage] no se pudo resolver el enlace de foto:", e);
    return { error: "No se pudo cargar ese enlace. Verifica que sea correcto." };
  }
  if (!res.ok) return { error: "No se pudo acceder a ese enlace." };

  const contentType = res.headers.get("content-type") ?? "";

  if (contentType.startsWith("image/")) {
    return { url: parsed.toString() };
  }

  if (contentType.includes("text/html")) {
    const html = await readTextCapped(res);
    const match =
      html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i) ??
      html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);

    if (match?.[1]) {
      const resolved = new URL(match[1], parsed).toString();
      return { url: resolved };
    }
    return { error: "No se encontró ninguna imagen en ese anuncio." };
  }

  return { error: "Ese enlace no parece tener una imagen." };
}
