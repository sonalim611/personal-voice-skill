export const dynamic = "force-dynamic";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { UploadPageClient } from "@/components/upload/upload-page-client";
import { getDocuments } from "@/actions";

export default async function UploadPage() {
  const documents = await getDocuments();

  return (
    <DashboardLayout>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Upload Samples</h1>
        <p className="mt-1 text-muted">Add writing samples to train your personal voice</p>
      </div>
      <UploadPageClient initialDocuments={documents} />
    </DashboardLayout>
  );
}
