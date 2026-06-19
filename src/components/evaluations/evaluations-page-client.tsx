"use client";

import { useState } from "react";
import { evaluateGeneration } from "@/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ScoreBar } from "@/components/ui/score-bar";
import { BarChart3, Sparkles } from "lucide-react";
import { formatDate, formatScore } from "@/lib/utils";
import { OUTPUT_TYPE_LABELS } from "@/types/database";
import type { Evaluation, Generation, OutputType } from "@/types/database";
import Link from "next/link";

type EvaluationWithGeneration = Evaluation & {
  generations: {
    topic: string;
    output_type: OutputType;
    generated_content: string;
  } | null;
};

interface EvaluationsPageClientProps {
  initialEvaluations: EvaluationWithGeneration[];
  generations: Generation[];
}

export function EvaluationsPageClient({
  initialEvaluations,
  generations,
}: EvaluationsPageClientProps) {
  const [evaluations, setEvaluations] = useState(initialEvaluations);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const evaluatedIds = new Set(evaluations.map((e) => e.generation_id));
  const unevaluatedGenerations = generations.filter((g) => !evaluatedIds.has(g.id));

  async function handleEvaluate(generationId: string) {
    setEvaluating(generationId);
    setError(null);

    const result = await evaluateGeneration(generationId);
    if (result.error) {
      setError(result.error);
    } else if (result.evaluation) {
      const gen = generations.find((g) => g.id === generationId);
      const newEval: EvaluationWithGeneration = {
        ...(result.evaluation as Evaluation),
        generations: gen
          ? {
              topic: gen.topic,
              output_type: gen.output_type,
              generated_content: gen.generated_content,
            }
          : null,
      };
      setEvaluations((prev) => [newEval, ...prev]);
    }
    setEvaluating(null);
  }

  const overallColor = (score: number) => {
    if (score >= 80) return "text-success";
    if (score >= 60) return "text-warning";
    return "text-danger";
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {unevaluatedGenerations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pending Evaluations</CardTitle>
            <CardDescription>Evaluate these generations for voice consistency</CardDescription>
          </CardHeader>
          <div className="space-y-3">
            {unevaluatedGenerations.map((gen) => (
              <div
                key={gen.id}
                className="flex items-center justify-between rounded-lg border border-border p-4"
              >
                <div>
                  <p className="font-medium text-foreground">{gen.topic}</p>
                  <p className="text-sm text-muted">
                    {OUTPUT_TYPE_LABELS[gen.output_type]} · {formatDate(gen.created_at)}
                  </p>
                </div>
                <Button
                  size="sm"
                  loading={evaluating === gen.id}
                  onClick={() => handleEvaluate(gen.id)}
                >
                  <BarChart3 className="h-4 w-4" />
                  Evaluate
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {evaluations.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="No evaluations yet"
          description="Generate content and evaluate it to see how well it matches your writing style"
          action={
            generations.length === 0 ? (
              <Link href="/generate">
                <Button>
                  <Sparkles className="h-4 w-4" />
                  Generate Content
                </Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {evaluations.map((evaluation) => (
            <Card key={evaluation.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <CardTitle className="text-base">
                      {evaluation.generations?.topic ?? "Unknown topic"}
                    </CardTitle>
                    <CardDescription>
                      {evaluation.generations
                        ? OUTPUT_TYPE_LABELS[evaluation.generations.output_type]
                        : ""}{" "}
                      · {formatDate(evaluation.created_at)}
                    </CardDescription>
                  </div>
                  <div className={`text-2xl font-bold ${overallColor(evaluation.overall_score)}`}>
                    {formatScore(evaluation.overall_score)}
                  </div>
                </div>
              </CardHeader>

              <div className="grid gap-4 sm:grid-cols-3 mb-4">
                <ScoreBar label="Tone Match" score={evaluation.tone_match} />
                <ScoreBar label="Vocabulary Match" score={evaluation.vocabulary_match} />
                <ScoreBar label="Structure Match" score={evaluation.structure_match} />
              </div>

              {evaluation.feedback && (
                <div className="rounded-lg bg-background border border-border p-4">
                  <p className="text-sm font-medium text-foreground mb-2">AI Feedback</p>
                  <p className="text-sm text-muted leading-relaxed">{evaluation.feedback}</p>
                </div>
              )}

              {evaluation.generations?.generated_content && (
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm font-medium text-primary hover:text-primary-hover">
                    View generated content
                  </summary>
                  <div className="mt-3 rounded-lg bg-background border border-border p-4">
                    <pre className="whitespace-pre-wrap text-sm text-muted font-sans leading-relaxed">
                      {evaluation.generations.generated_content}
                    </pre>
                  </div>
                </details>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
