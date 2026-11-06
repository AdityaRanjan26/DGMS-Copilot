"use client";

import { ArrowRight, Bot, Database, FileText, Layers3, LockKeyhole, ScanText, ServerCog } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { architectureStages } from "@/lib/platform-data";
import { isAdmin } from "@/lib/auth";
import { useLanguage } from "@/lib/i18n/LanguageContext";

const icons = [FileText, ScanText, Layers3, Database, ServerCog, Bot];

// ─── Access Denied ────────────────────────────────────────────────────────────

function AccessDenied() {
  const { t } = useLanguage();
  return (
    <>
      <PageHeader
        eyebrow="System Architecture"
        title="Access restricted"
        description="This page is available to platform administrators only."
      />
      <div className="container py-12">
        <Card className="mx-auto max-w-md">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <LockKeyhole className="h-8 w-8" />
            </div>
            <div>
              <p className="text-xl font-bold">{t("admin.accessDenied")}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("admin.accessDeniedDesc")}
              </p>
            </div>
            <Badge tone="amber">{t("admin.adminRequired")}</Badge>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArchitecturePage() {
  if (!isAdmin()) {
    return <AccessDenied />;
  }

  return (
    <>
      <PageHeader
        eyebrow="System Architecture"
        title="DGMS-Copilot knowledge and retrieval architecture"
        description="Enterprise architecture view showing how compliance documents move from controlled ingestion to citation-backed assistant responses."
      />
      <div className="container space-y-6 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Document intelligence flow</CardTitle>
            <CardDescription>Documents to assistant response, with traceability preserved at every stage.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 xl:grid-cols-6">
              {architectureStages.map((stage, index) => {
                const Icon = icons[index];
                return (
                  <div key={stage.title} className="relative">
                    <div className="h-full rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/25">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                          <Icon className="h-5 w-5" />
                        </div>
                        <Badge tone={index < 3 ? "blue" : "green"}>Layer {index + 1}</Badge>
                      </div>
                      <p className="mt-4 text-base font-bold">{stage.title}</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{stage.description}</p>
                    </div>
                    {index < architectureStages.length - 1 ? (
                      <div className="hidden xl:absolute xl:-right-3 xl:top-1/2 xl:z-10 xl:flex xl:h-6 xl:w-6 xl:-translate-y-1/2 xl:items-center xl:justify-center xl:rounded-full xl:border xl:bg-card">
                        <ArrowRight className="h-3.5 w-3.5 text-primary" />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Control plane</CardTitle>
              <CardDescription>Governance controls that keep answers auditable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                "Role-based access controls for safety, governance, and document administration",
                "Source metadata retained through OCR, segmentation, embedding, and retrieval",
                "Confidence thresholds and citation validation before assistant response display"
              ].map((item) => (
                <div key={item} className="rounded-md border bg-card p-3 text-sm font-semibold transition-colors hover:bg-muted/35">
                  {item}
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Current integration status</CardTitle>
              <CardDescription>Deployment-level status across the architecture layers.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-hidden rounded-md border">
                {[
                  ["Document ingestion", "Available"],
                  ["Clause traceability", "Available"],
                  ["Retrieval orchestration", "Configured"],
                  ["Assistant response panel", "Available"]
                ].map(([name, status]) => (
                  <div key={name} className="grid grid-cols-[1fr_140px] border-t bg-card px-4 py-3 text-sm first:border-t-0 hover:bg-muted/35">
                    <span className="font-semibold">{name}</span>
                    <Badge tone={status === "Configured" ? "blue" : "green"}>{status}</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
