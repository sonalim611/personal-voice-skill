export const dynamic = "force-dynamic";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GeneratePageClient } from "@/components/generate/generate-page-client";
import { getGenerations, getDashboardStats } from "@/actions";

export default async function GeneratePage() {
  const [generations, stats] = await Promise.all([getGenerations(), getDashboardStats()]);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Generate Content</h1>
        <p className="mt-1 text-muted">Create new content that sounds like you</p>
      </div>
      <GeneratePageClient
        initialGenerations={generations}
        hasVoiceProfile={stats.hasVoiceProfile}
      />
    </DashboardLayout>
  );
}
