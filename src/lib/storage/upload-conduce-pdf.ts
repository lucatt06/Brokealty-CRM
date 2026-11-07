import { putFile } from "@/lib/storage/blob";

const FOLDER = "conduce-documents";

export async function uploadConducePdf(buffer: Buffer, conduceId: string): Promise<string> {
  return putFile(FOLDER, buffer, "application/pdf", "pdf", `${conduceId}-`);
}
