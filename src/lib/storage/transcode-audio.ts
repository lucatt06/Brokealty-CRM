import { execFile } from "child_process";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import path from "path";
import { promisify } from "util";

const run = promisify(execFile);

/**
 * Las notas de voz de WhatsApp son OGG/Opus, que Safari (Mac/iPhone) no reproduce.
 * Se convierten a M4A/AAC, que reproduce cualquier navegador. Si ffmpeg falla, se devuelve el original.
 */
export async function toPlayableAudio(buffer: Buffer, mimetype: string): Promise<{ buffer: Buffer; mimetype: string; ext: string } | null> {
  if (!/ogg|opus/i.test(mimetype)) return null;
  let dir: string | null = null;
  try {
    // require dinámico: ffmpeg-static resuelve la ruta del binario en runtime.
    const ffmpegPath = (eval("require") as NodeRequire)("ffmpeg-static") as string | null;
    if (!ffmpegPath) return null;
    dir = await mkdtemp(path.join(tmpdir(), "voice-"));
    const input = path.join(dir, "in.ogg");
    const output = path.join(dir, "out.m4a");
    await writeFile(input, buffer);
    await run(ffmpegPath, ["-y", "-i", input, "-vn", "-c:a", "aac", "-b:a", "64k", "-movflags", "+faststart", output], { timeout: 30_000 });
    return { buffer: await readFile(output), mimetype: "audio/mp4", ext: "m4a" };
  } catch (err) {
    console.error("No se pudo convertir la nota de voz a M4A:", err);
    return null;
  } finally {
    if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}
