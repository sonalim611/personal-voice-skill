import { getGeminiClient, GENERATION_MODEL } from "./client";
import { withGeminiError } from "./errors";
import type { VoiceAnalysis } from "@/types/database";

const VOICE_ANALYSIS_PROMPT = `You are an expert writing style analyst. Analyze the following writing samples and extract the author's unique voice characteristics.

Return your analysis as valid JSON with exactly these fields:
{
  "tone": "Description of the overall tone (e.g., conversational, authoritative, warm)",
  "sentence_structure": "Description of typical sentence patterns and length preferences",
  "vocabulary_patterns": "Description of word choice, jargon usage, and vocabulary level",
  "formality_level": "Description of formality (e.g., casual, semi-formal, professional)",
  "recurring_phrases": ["array", "of", "recurring", "phrases", "or", "expressions"],
  "writing_strengths": ["array", "of", "notable", "writing", "strengths"],
  "summary": "A 2-3 sentence summary of this person's unique writing voice"
}

Writing samples:
`;

export async function analyzeVoiceProfile(samples: string[]): Promise<VoiceAnalysis> {
  return withGeminiError(async () => {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: GENERATION_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const combinedSamples = samples
      .map((s, i) => `--- Sample ${i + 1} ---\n${s}`)
      .join("\n\n");

    const result = await model.generateContent(VOICE_ANALYSIS_PROMPT + combinedSamples);
    const text = result.response.text();
    const parsed = JSON.parse(text) as VoiceAnalysis;

    return {
      tone: parsed.tone ?? "",
      sentence_structure: parsed.sentence_structure ?? "",
      vocabulary_patterns: parsed.vocabulary_patterns ?? "",
      formality_level: parsed.formality_level ?? "",
      recurring_phrases: Array.isArray(parsed.recurring_phrases) ? parsed.recurring_phrases : [],
      writing_strengths: Array.isArray(parsed.writing_strengths) ? parsed.writing_strengths : [],
      summary: parsed.summary ?? "",
    };
  });
}
