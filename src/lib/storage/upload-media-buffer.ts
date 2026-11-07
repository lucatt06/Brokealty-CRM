import { putFile } from "@/lib/storage/blob";

// Mismo folder que los adjuntos del chat de prueba del bot — es el mismo
// tipo de contenido (imágenes/documentos que aparecen en una conversación).
const CHAT_FOLDER = "chat-attachments";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif",
  "application/pdf": "pdf",
  "video/mp4": "mp4", "video/3gpp": "3gp",
  "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/webm": "webm",
};

/** Sube un Buffer (media descargada de un webhook, sin pasar por un <input type="file">) a los adjuntos del chat. */
export async function uploadMediaBuffer(buffer: Buffer, mimetype: string): Promise<string> {
  const ext = EXT_BY_MIME[mimetype] ?? mimetype.split("/")[1]?.split(";")[0] ?? "bin";
  return putFile(CHAT_FOLDER, buffer, mimetype, ext);
}
