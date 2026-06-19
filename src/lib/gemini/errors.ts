export function parseGeminiError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("limit: 0") || message.includes("limit:0")) {
    return [
      "Your Gemini API project has no quota for this model (limit: 0).",
      "Fix: open Google AI Studio → Settings → Billing and link a Google Cloud billing account (free tier still applies).",
      "Also set GEMINI_GENERATION_MODEL=gemini-2.5-flash in .env.local if needed.",
    ].join(" ");
  }

  if (message.includes("429") || message.includes("Too Many Requests")) {
    const retryMatch = message.match(/retry in ([\d.]+)s/i);
    const wait = retryMatch ? ` Try again in ~${Math.ceil(Number(retryMatch[1]))} seconds.` : " Wait a minute and try again.";
    return `Gemini rate limit reached.${wait}`;
  }

  if (message.includes("404") && message.includes("models/")) {
    return `Gemini model not found. Set GEMINI_GENERATION_MODEL in .env.local to a supported model (e.g. gemini-2.5-flash).`;
  }

  return message;
}

export async function withGeminiError<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw new Error(parseGeminiError(error));
  }
}
