"use client";

import { useState } from "react";
import { generateStyledContent, evaluateGeneration } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Sparkles, Copy, Check, BarChart3 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Generation, OutputType } from "@/types/database";
import { OUTPUT_TYPE_LABELS } from "@/types/database";
import Link from "next/link";

interface GeneratePageClientProps {
  initialGenerations: Generation[];
  hasVoiceProfile: boolean;
}

const outputTypes: OutputType[] = ["linkedin_post", "blog_post", "email", "tweet_thread"];

export function GeneratePageClient({ initialGenerations, hasVoiceProfile }: GeneratePageClientProps) {
  const [generations, setGenerations] = useState(initialGenerations);
  const [topic, setTopic] = useState("");
  const [outputType, setOutputType] = useState<OutputType>("linkedin_post");
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [latestGeneration, setLatestGeneration] = useState<Generation | null>(null);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim()) return;

    setLoading(true);
    setError(null);
    setLatestGeneration(null);

    const result = await generateStyledContent(topic, outputType);
    if (result.error) {
      setError(result.error);
    } else if (result.generation) {
      const gen = result.generation as Generation;
      setLatestGeneration(gen);
      setGenerations((prev) => [gen, ...prev]);
    }
    setLoading(false);
  }

  async function handleEvaluate(generationId: string) {
    setEvaluating(generationId);
    const result = await evaluateGeneration(generationId);
    if (result.error) {
      setError(result.error);
    }
    setEvaluating(null);
  }

  async function handleCopy(content: string, id: string) {
    await navigator.clipboard.writeText(content);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }

  if (!hasVoiceProfile) {
    return (
      <EmptyState
        icon={Sparkles}
        title="Voice profile required"
        description="Create your voice profile before generating content"
        action={
          <Link href="/voice-profile">
            <Button>Create Voice Profile</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Generate Content</CardTitle>
          <CardDescription>
            Create new content in your personal writing style
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Topic</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., The importance of mentorship in tech careers"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">Output Type</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {outputTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setOutputType(type)}
                  className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                    outputType === type
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted hover:border-primary/50 hover:text-foreground"
                  }`}
                >
                  {OUTPUT_TYPE_LABELS[type]}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
              {error}
            </div>
          )}

          <Button type="submit" loading={loading}>
            <Sparkles className="h-4 w-4" />
            Generate
          </Button>
        </form>
      </Card>

      {loading && (
        <div className="py-12">
          <LoadingSpinner size="lg" label="Generating content in your voice..." />
        </div>
      )}

      {latestGeneration && !loading && (
        <Card className="border-primary/30">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Latest Generation</CardTitle>
                <CardDescription>
                  {OUTPUT_TYPE_LABELS[latestGeneration.output_type]} · {latestGeneration.topic}
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(latestGeneration.generated_content, latestGeneration.id)}
                >
                  {copied === latestGeneration.id ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  loading={evaluating === latestGeneration.id}
                  onClick={() => handleEvaluate(latestGeneration.id)}
                >
                  <BarChart3 className="h-4 w-4" />
                  Evaluate
                </Button>
              </div>
            </div>
          </CardHeader>
          <div className="rounded-lg bg-background border border-border p-4">
            <pre className="whitespace-pre-wrap text-sm text-foreground font-sans leading-relaxed">
              {latestGeneration.generated_content}
            </pre>
          </div>
        </Card>
      )}

      {generations.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold">Generation History</h2>
          <div className="space-y-3">
            {generations.map((gen) => (
              <Card key={gen.id} className="!p-4">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{gen.topic}</p>
                      <Badge variant="accent">{OUTPUT_TYPE_LABELS[gen.output_type]}</Badge>
                    </div>
                    <p className="text-sm text-muted mt-1">{formatDate(gen.created_at)}</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopy(gen.generated_content, gen.id)}
                    >
                      {copied === gen.id ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Link href="/evaluations">
                      <Button variant="secondary" size="sm">
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
                <p className="text-sm text-muted line-clamp-3">{gen.generated_content}</p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
