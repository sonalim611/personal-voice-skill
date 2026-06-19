import { getGeminiClient, GENERATION_MODEL } from "./client";
import { withGeminiError } from "./errors";
import type { OutputType, VoiceProfile } from "@/types/database";
import { OUTPUT_TYPE_LABELS } from "@/types/database";

const OUTPUT_INSTRUCTIONS: Record<OutputType, string> = {
  linkedin_post:
    "Write a LinkedIn post (150-300 words). Use line breaks for readability. Include a hook opening and end with a question or call-to-action if appropriate.",
  blog_post:
    "Write a blog post (500-800 words) with a compelling title, introduction, 2-3 sections with subheadings, and a conclusion.",
  email:
    "Write a professional email with a clear subject line, greeting, body, and sign-off. Keep it concise and actionable.",
  tweet_thread:
    "Write a Twitter/X thread of 3-5 tweets. Number each tweet. Keep each under 280 characters. Make the first tweet a strong hook.",
};

function buildVoiceContext(profile: VoiceProfile): string {
  return `VOICE PROFILE:
- Tone: ${profile.tone ?? "Not specified"}
- Sentence Structure: ${profile.sentence_structure ?? "Not specified"}
- Vocabulary: ${profile.vocabulary_patterns ?? "Not specified"}
- Formality: ${profile.formality_level ?? "Not specified"}
- Recurring Phrases: ${profile.recurring_phrases?.join(", ") || "None identified"}
- Writing Strengths: ${profile.writing_strengths?.join(", ") || "None identified"}
- Summary: ${profile.summary ?? "Not specified"}`;
}

export function buildGenerationPrompt(
  topic: string,
  outputType: OutputType,
  profile: VoiceProfile,
  examples: string[]
): string {
  const examplesText =
    examples.length > 0
      ? examples.map((e, i) => `Example ${i + 1}:\n${e}`).join("\n\n")
      : "No examples available.";

  return `You are a ghostwriter who perfectly mimics the author's personal writing style.

${buildVoiceContext(profile)}

RELEVANT WRITING EXAMPLES FROM THE AUTHOR:
${examplesText}

TASK: Write a ${OUTPUT_TYPE_LABELS[outputType]} about the following topic:
"${topic}"

INSTRUCTIONS:
${OUTPUT_INSTRUCTIONS[outputType]}

CRITICAL RULES:
1. Match the author's tone, vocabulary, and sentence structure exactly
2. Use their recurring phrases naturally where appropriate
3. Do NOT sound generic or AI-generated
4. Write ONLY the content — no meta-commentary or explanations
5. The output should be indistinguishable from the author's own writing`;
}

export async function generateContent(prompt: string): Promise<string> {
  return withGeminiError(async () => {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({ model: GENERATION_MODEL });
    const result = await model.generateContent(prompt);
    return result.response.text().trim();
  });
}
