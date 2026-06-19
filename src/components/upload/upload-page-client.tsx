"use client";

import { useState, useRef } from "react";
import { uploadFile, uploadPastedText, deleteDocument } from "@/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Upload, FileText, Trash2, Linkedin } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Document } from "@/types/database";
import { SOURCE_TYPE_LABELS } from "@/types/database";

interface UploadPageClientProps {
  initialDocuments: Document[];
}

export function UploadPageClient({ initialDocuments }: UploadPageClientProps) {
  const [documents, setDocuments] = useState(initialDocuments);
  const [activeTab, setActiveTab] = useState<"file" | "paste" | "linkedin">("file");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFileUpload(formData: FormData) {
    setLoading(true);
    setError(null);
    setSuccess(null);

    const result = await uploadFile(formData);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("File uploaded and processed successfully!");
      const refreshed = await fetch("/api/documents").then((r) => r.json());
      setDocuments(refreshed.documents ?? []);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }
    setLoading(false);
  }

  async function handlePasteUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const title = (form.elements.namedItem("title") as HTMLInputElement).value;
    const text = (form.elements.namedItem("text") as HTMLTextAreaElement).value;
    const sourceType = activeTab === "linkedin" ? "linkedin" : "paste";

    const result = await uploadPastedText(title, text, sourceType);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess("Text uploaded and processed successfully!");
      const refreshed = await fetch("/api/documents").then((r) => r.json());
      setDocuments(refreshed.documents ?? []);
      form.reset();
    }
    setLoading(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this document and all associated data?")) return;
    const result = await deleteDocument(id);
    if (result.error) {
      setError(result.error);
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    }
  }

  const statusVariant = (status: string) => {
    switch (status) {
      case "completed": return "success" as const;
      case "processing": return "warning" as const;
      case "failed": return "danger" as const;
      default: return "default" as const;
    }
  };

  const tabs = [
    { id: "file" as const, label: "Upload File", icon: Upload },
    { id: "paste" as const, label: "Paste Text", icon: FileText },
    { id: "linkedin" as const, label: "LinkedIn Post", icon: Linkedin },
  ];

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle>Upload Writing Samples</CardTitle>
          <CardDescription>
            Upload PDF, TXT files, or paste your writing samples and LinkedIn posts
          </CardDescription>
        </CardHeader>

        <div className="mb-6 flex gap-2 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-lg bg-success/10 border border-success/20 px-4 py-3 text-sm text-success">
            {success}
          </div>
        )}

        {activeTab === "file" && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              await handleFileUpload(formData);
            }}
            className="space-y-4"
          >
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title (optional)</label>
              <Input name="title" placeholder="My blog post" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">File (PDF or TXT, max 10MB)</label>
              <Input
                ref={fileRef}
                name="file"
                type="file"
                accept=".pdf,.txt,.md,text/plain,application/pdf"
                required
              />
            </div>
            <Button type="submit" loading={loading}>
              <Upload className="h-4 w-4" />
              Upload & Process
            </Button>
          </form>
        )}

        {(activeTab === "paste" || activeTab === "linkedin") && (
          <form onSubmit={handlePasteUpload} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Title</label>
              <Input
                name="title"
                placeholder={activeTab === "linkedin" ? "My LinkedIn post about leadership" : "Sample title"}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">
                {activeTab === "linkedin" ? "LinkedIn Post Content" : "Text Content"}
              </label>
              <Textarea
                name="text"
                placeholder={
                  activeTab === "linkedin"
                    ? "Paste your LinkedIn post here..."
                    : "Paste your writing sample here..."
                }
                required
                className="min-h-[200px]"
              />
            </div>
            <Button type="submit" loading={loading}>
              <Upload className="h-4 w-4" />
              Submit & Process
            </Button>
          </form>
        )}
      </Card>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Your Documents</h2>
        {documents.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No documents yet"
            description="Upload your first writing sample to start building your voice profile"
          />
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <Card key={doc.id} className="flex items-center justify-between !p-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="rounded-lg bg-primary/10 p-2 shrink-0">
                    <FileText className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{doc.title}</p>
                    <p className="text-sm text-muted">
                      {SOURCE_TYPE_LABELS[doc.source_type]} · {formatDate(doc.created_at)}
                    </p>
                    {doc.error_message && (
                      <p className="text-sm text-danger mt-1">{doc.error_message}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <Badge variant={statusVariant(doc.status)}>{doc.status}</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc.id)}
                    aria-label="Delete document"
                  >
                    <Trash2 className="h-4 w-4 text-danger" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
