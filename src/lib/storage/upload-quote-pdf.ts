import { putFile } from "@/lib/storage/blob";

const FOLDER = "quote-documents";

export async function uploadQuotePdf(buffer: Buffer, quoteId: string): Promise<string> {
  return putFile(FOLDER, buffer, "application/pdf", "pdf", `${quoteId}-`);
}
