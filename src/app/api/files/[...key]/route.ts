import { getFile } from "@/lib/storage/blob";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: { key: string[] } }) {
  const key = params.key.map(decodeURIComponent).join("/");
  // Sin traversal: las claves siempre son `carpeta/archivo`.
  if (key.includes("..") || key.startsWith("/")) return new Response("Not found", { status: 404 });

  try {
    const file = await getFile(key);
    if (!file.body) return new Response("Not found", { status: 404 });
    const bytes = await file.body.transformToByteArray();
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": file.contentType ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
