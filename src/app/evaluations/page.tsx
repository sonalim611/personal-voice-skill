export const dynamic = "force-dynamic";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EvaluationsPageClient } from "@/components/evaluations/evaluations-page-client";
import { getEvaluations, getGenerations } from "@/actions";

export default async function EvaluationsPage() {
  const [evaluations, generations] = await Promise.all([
    getEvaluations(),
    getGenerations(),
  ]);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Evaluations</h1>
        <p className="mt-1 text-muted">Voice consistency scores for your generated content</p>
      </div>
      <EvaluationsPageClient
        initialEvaluations={evaluations}
        generations={generations}
      />
    </DashboardLayout>
  );
}
