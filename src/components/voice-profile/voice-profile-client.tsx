"use client";

import { useState } from "react";
import { createVoiceProfile } from "@/actions";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Mic, RefreshCw } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { VoiceProfile } from "@/types/database";
import Link from "next/link";

interface VoiceProfileClientProps {
  profile: VoiceProfile | null;
  documentCount: number;
}

export function VoiceProfileClient({ profile: initialProfile, documentCount }: VoiceProfileClientProps) {
  const [profile, setProfile] = useState(initialProfile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreateProfile() {
    setLoading(true);
    setError(null);

    const result = await createVoiceProfile();
    if (result.error) {
      setError(result.error);
    } else if (result.profile) {
      setProfile(result.profile as VoiceProfile);
    }
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="py-20">
        <LoadingSpinner size="lg" label="Analyzing your writing style..." />
      </div>
    );
  }

  if (!profile) {
    return (
      <EmptyState
        icon={Mic}
        title="No voice profile yet"
        description={
          documentCount === 0
            ? "Upload at least one writing sample before creating your voice profile"
            : "Analyze your writing samples to create your personalized voice profile"
        }
        action={
          documentCount === 0 ? (
            <Link href="/upload">
              <Button>Upload Samples</Button>
            </Link>
          ) : (
            <div className="space-y-4 text-center">
              {error && (
                <div className="rounded-lg bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
                  {error}
                </div>
              )}
              <Button onClick={handleCreateProfile}>
                <Mic className="h-4 w-4" />
                Create Voice Profile
              </Button>
            </div>
          )
        }
      />
    );
  }

  const sections = [
    { label: "Tone", value: profile.tone },
    { label: "Sentence Structure", value: profile.sentence_structure },
    { label: "Vocabulary Patterns", value: profile.vocabulary_patterns },
    { label: "Formality Level", value: profile.formality_level },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">Your Voice Profile</h2>
            <Badge variant="success">Active</Badge>
          </div>
          <p className="text-sm text-muted mt-1">
            Based on {profile.document_count} document{profile.document_count !== 1 ? "s" : ""} ·
            Updated {formatDate(profile.updated_at)}
          </p>
        </div>
        <Button variant="secondary" onClick={handleCreateProfile}>
          <RefreshCw className="h-4 w-4" />
          Regenerate Profile
        </Button>
      </div>

      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {profile.summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Voice Summary</CardTitle>
          </CardHeader>
          <p className="text-foreground leading-relaxed">{profile.summary}</p>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((section) => (
          <Card key={section.label}>
            <CardHeader className="mb-2">
              <CardTitle className="text-base">{section.label}</CardTitle>
            </CardHeader>
            <p className="text-sm text-muted leading-relaxed">{section.value || "Not analyzed"}</p>
          </Card>
        ))}
      </div>

      {profile.recurring_phrases?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recurring Phrases</CardTitle>
            <CardDescription>Expressions you use frequently</CardDescription>
          </CardHeader>
          <div className="flex flex-wrap gap-2">
            {profile.recurring_phrases.map((phrase) => (
              <Badge key={phrase} variant="accent">{phrase}</Badge>
            ))}
          </div>
        </Card>
      )}

      {profile.writing_strengths?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Writing Strengths</CardTitle>
            <CardDescription>What makes your writing distinctive</CardDescription>
          </CardHeader>
          <ul className="space-y-2">
            {profile.writing_strengths.map((strength) => (
              <li key={strength} className="flex items-start gap-2 text-sm text-foreground">
                <span className="text-success mt-0.5">✓</span>
                {strength}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
