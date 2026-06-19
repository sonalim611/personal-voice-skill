export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const data = await pdfParse(buffer);
  return data.text.trim();
}

export function extractTextFromTxt(buffer: Buffer): string {
  return buffer.toString("utf-8").trim();
}

export async function extractText(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  if (mimeType === "application/pdf") {
    return extractTextFromPdf(buffer);
  }
  if (mimeType === "text/plain" || mimeType === "text/markdown") {
    return extractTextFromTxt(buffer);
  }
  throw new Error(`Unsupported file type: ${mimeType}`);
}
