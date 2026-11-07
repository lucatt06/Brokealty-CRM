import { putFile } from "@/lib/storage/blob";

const FOLDER = "contract-documents";

export async function uploadContractPdf(buffer: Buffer, contractId: string): Promise<string> {
  return putFile(FOLDER, buffer, "application/pdf", "pdf", `${contractId}-`);
}
