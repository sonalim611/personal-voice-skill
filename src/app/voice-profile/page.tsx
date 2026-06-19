export const dynamic = "force-dynamic";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { VoiceProfileClient } from "@/components/voice-profile/voice-profile-client";
import { getVoiceProfile, getDashboardStats } from "@/actions";

export default async function VoiceProfilePage() {
  const [profile, stats] = await Promise.all([getVoiceProfile(), getDashboardStats()]);

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Voice Profile</h1>
        <p className="mt-1 text-muted">Your unique writing style analyzed by AI</p>
      </div>
      <VoiceProfileClient profile={profile} documentCount={stats.documentCount} />
    </DashboardLayout>
  );
}
