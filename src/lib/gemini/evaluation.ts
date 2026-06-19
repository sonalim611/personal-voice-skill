import { getGeminiClient, GENERATION_MODEL } from "./client";
import { withGeminiError } from "./errors";
import type { EvaluationResult, VoiceProfile } from "@/types/database";

const EVALUATION_PROMPT = `You are an expert writing style evaluator. Compare the GENERATED CONTENT against the author's VOICE PROFILE and WRITING SAMPLES.

Score each dimension from 0 to 100:
- tone_match: How well does the tone match the author's style?
- vocabulary_match: How well does the word choice and vocabulary match?
- structure_match: How well do sentence structure and formatting match?
- overall_score: Overall voice similarity score

Also provide detailed feedback explaining the scores and specific improvements.

Return valid JSON:
{
  "tone_match": 85,
  "vocabulary_match": 78,
  "structure_match": 82,
  "overall_score": 81,
  "feedback": "Detailed feedback here..."
}
`;

export async function evaluateContent(
  generatedContent: string,
  profile: VoiceProfile,
  writingSamples: string[]
): Promise<EvaluationResult> {
  return withGeminiError(async () => {
    const client = getGeminiClient();
    const model = client.getGenerativeModel({
      model: GENERATION_MODEL,
      generationConfig: {
        responseMimeType: "application/json",
      },
    });

    const samplesText = writingSamples
      .slice(0, 5)
      .map((s, i) => `Sample ${i + 1}:\n${s}`)
      .join("\n\n");

    const prompt = `${EVALUATION_PROMPT}

VOICE PROFILE:
- Tone: ${profile.tone}
- Sentence Structure: ${profile.sentence_structure}
- Vocabulary: ${profile.vocabulary_patterns}
- Formality: ${profile.formality_level}
- Recurring Phrases: ${profile.recurring_phrases?.join(", ")}
- Summary: ${profile.summary}

WRITING SAMPLES:
${samplesText}

GENERATED CONTENT TO EVALUATE:
${generatedContent}`;

    const result = await model.generateContent(prompt);
    const parsed = JSON.parse(result.response.text()) as EvaluationResult;

    return {
      tone_match: clampScore(parsed.tone_match),
      vocabulary_match: clampScore(parsed.vocabulary_match),
      structure_match: clampScore(parsed.structure_match),
      overall_score: clampScore(parsed.overall_score),
      feedback: parsed.feedback ?? "No feedback provided.",
    };
  });
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Number(value) || 0));
}
