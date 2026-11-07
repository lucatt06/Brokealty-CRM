import { randomUUID } from "crypto";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

/**
 * Almacenamiento de archivos sobre un Bucket S3-compatible de Railway.
 * Variables (las inyecta Railway al referenciar el bucket):
 *   AWS_ENDPOINT_URL, AWS_S3_BUCKET_NAME, AWS_DEFAULT_REGION,
 *   AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * Los buckets de Railway son privados: los archivos se sirven a través de
 * /api/files/<key> (route handler), con claves no adivinables (UUID).
 */

let client: S3Client | null = null;

function s3() {
  if (!client) {
    const endpoint = process.env.AWS_ENDPOINT_URL;
    if (!endpoint || !process.env.AWS_S3_BUCKET_NAME) {
      throw new Error("Almacenamiento no configurado: faltan AWS_ENDPOINT_URL / AWS_S3_BUCKET_NAME.");
    }
    client = new S3Client({
      endpoint,
      region: process.env.AWS_DEFAULT_REGION ?? "auto",
      // Los Buckets de Railway usan URLs estilo virtual-host (bucket.endpoint).
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "",
      },
    });
  }
  return client;
}

const bucketName = () => process.env.AWS_S3_BUCKET_NAME!;

export function publicFileUrl(key: string) {
  const base = (process.env.APP_URL ?? process.env.WEBHOOK_BASE_URL ?? "").replace(/\/$/, "");
  return `${base}/api/files/${key}`;
}

/** Sube un archivo bajo `folder/` y devuelve su URL pública. */
export async function putFile(folder: string, buffer: Buffer, contentType: string, ext: string, namePrefix = ""): Promise<string> {
  const key = `${folder}/${namePrefix}${randomUUID()}.${ext}`;
  await s3().send(
    new PutObjectCommand({ Bucket: bucketName(), Key: key, Body: buffer, ContentType: contentType })
  );
  return publicFileUrl(key);
}

export async function getFile(key: string) {
  const res = await s3().send(new GetObjectCommand({ Bucket: bucketName(), Key: key }));
  return { body: res.Body, contentType: res.ContentType, contentLength: res.ContentLength };
}
