import { getFile } from "@/lib/storage/blob";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.map(decodeURIComponent).join("/");
  // Sin traversal: las claves siempre son `carpeta/archivo`.
  if (key.includes("..") || key.startsWith("/")) return new Response("Not found", { status: 404 });

  try {
    const file = await getFile(key);
    if (!file.body) return new Response("Not found", { status: 404 });
    const bytes = Buffer.from(await file.body.transformToByteArray());
    const headers: Record<string, string> = {
      "Content-Type": file.contentType ?? "application/octet-stream",
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
      "X-Content-Type-Options": "nosniff",
    };

    // Safari exige respuestas 206 (Range) para reproducir audio/video.
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
    if (range && (range[1] || range[2])) {
      const total = bytes.length;
      const start = range[1] ? parseInt(range[1], 10) : Math.max(total - parseInt(range[2], 10), 0);
      let end = range[1] && range[2] ? parseInt(range[2], 10) : total - 1;
      end = Math.min(end, total - 1);
      if (start > end || start >= total) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
      }
      return new Response(bytes.subarray(start, end + 1), {
        status: 206,
        headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${total}`, "Content-Length": String(end - start + 1) },
      });
    }
    return new Response(bytes, { headers: { ...headers, "Content-Length": String(bytes.length) } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
