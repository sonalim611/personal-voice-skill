export const dynamic = "force-dynamic";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { getDashboardStats } from "@/actions";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Mic, Sparkles, BarChart3, ArrowRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "accent";

export default async function DashboardPage() {
  const stats = await getDashboardStats();

  const cards: Array<{
    title: string;
    value: number | string;
    description: string;
    icon: LucideIcon;
    href: string;
    status: BadgeVariant;
  }> = [
    {
      title: "Writing Samples",
      value: stats.documentCount,
      description: "Uploaded documents",
      icon: FileText,
      href: "/upload",
      status: stats.documentCount > 0 ? "success" : "warning",
    },
    {
      title: "Voice Profile",
      value: stats.hasVoiceProfile ? "Active" : "Not Created",
      description: stats.hasVoiceProfile ? "Profile ready" : "Create your profile",
      icon: Mic,
      href: "/voice-profile",
      status: stats.hasVoiceProfile ? "success" : "warning",
    },
    {
      title: "Generations",
      value: stats.generationCount,
      description: "Content pieces created",
      icon: Sparkles,
      href: "/generate",
      status: "accent",
    },
    {
      title: "Evaluations",
      value: stats.evaluationCount,
      description: "Voice consistency checks",
      icon: BarChart3,
      href: "/evaluations",
      status: "accent",
    },
  ];

  const steps = [
    { step: 1, title: "Upload Writing Samples", done: stats.documentCount > 0, href: "/upload" },
    { step: 2, title: "Create Voice Profile", done: stats.hasVoiceProfile, href: "/voice-profile" },
    { step: 3, title: "Generate Content", done: stats.generationCount > 0, href: "/generate" },
    { step: 4, title: "Evaluate Results", done: stats.evaluationCount > 0, href: "/evaluations" },
  ];

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="mt-1 text-muted">Your personal voice writing assistant</p>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link key={card.title} href={card.href}>
            <Card hover className="h-full">
              <div className="flex items-start justify-between">
                <div className="rounded-lg bg-primary/10 p-2">
                  <card.icon className="h-5 w-5 text-primary" />
                </div>
                <Badge variant={card.status}>
                  {typeof card.value === "number" ? card.value : card.value}
                </Badge>
              </div>
              <CardHeader className="mt-3 mb-0">
                <CardTitle className="text-base">{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>Follow these steps to start generating content in your voice</CardDescription>
        </CardHeader>
        <div className="space-y-3">
          {steps.map((item) => (
            <Link
              key={item.step}
              href={item.href}
              className="flex items-center justify-between rounded-lg border border-border p-4 transition-colors hover:bg-card-hover"
            >
              <div className="flex items-center gap-4">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    item.done
                      ? "bg-success/10 text-success"
                      : "bg-border text-muted"
                  }`}
                >
                  {item.done ? "✓" : item.step}
                </div>
                <span className="font-medium text-foreground">{item.title}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-muted" />
            </Link>
          ))}
        </div>
      </Card>
    </DashboardLayout>
  );
}
