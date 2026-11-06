"use client";
import { useState, useEffect } from "react";
import { Settings2, ShieldCheck, UsersRound, Database, FilePlus2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { adminRows } from "@/lib/platform-data";
import { useLanguage } from "@/lib/i18n/LanguageContext";

// Simple inline toast
function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 rounded-lg border bg-card px-4 py-3 shadow-lg text-sm font-medium animate-fade-in max-w-sm">
      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
      {message}
    </div>
  );
}

export default function AdminPage() {
  const { t } = useLanguage();
  const [toast, setToast] = useState<string | null>(null);

  const handleConfigure = () => {
    setToast(t("admin.configureToast"));
  };

  // Translated role cards
  const accessRoles = [
    { role: t("admin.roleExecutive"), detail: t("admin.roleExecutiveDesc") },
    { role: t("admin.roleSafety"), detail: t("admin.roleSafetyDesc") },
    { role: t("admin.roleDocAdmin"), detail: t("admin.roleDocAdminDesc") },
  ];

  return (
    <>
      <PageHeader
        eyebrow={t("admin.title")}
        title={t("admin.subtitle")}
        description={t("admin.description")}
        action={
          <Button onClick={handleConfigure}>
            <Settings2 className="h-4 w-4" />
            {t("admin.configure")}
          </Button>
        }
      />
      <div className="container grid gap-6 py-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.trackerTitle")}</CardTitle>
              <CardDescription>{t("admin.trackerDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {adminRows.map((row) => (
                <div key={row.labelKey} className="grid gap-3 rounded-md border bg-card p-4 transition-colors hover:bg-muted/35 md:grid-cols-[1fr_180px_180px] md:items-center">
                  <p className="font-semibold">{t(row.labelKey)}</p>
                  <Badge tone={row.statusKey === "admin.statusScheduled" ? "amber" : "green"}>
                    {t(row.statusKey)}
                  </Badge>
                  <p className="text-sm text-muted-foreground">{t(row.ownerKey)}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Ingestion Pipeline + Corpus health */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>{t("repository.pipelineTitle")}</CardTitle>
                <CardDescription>{t("repository.pipelineDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[t("repository.stage1"), t("repository.stage2"), t("repository.stage3"), t("repository.stage4"), t("repository.stage5")].map((step, index) => (
                  <div key={step} className="flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-muted/35">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">
                      {index + 1}
                    </div>
                    <span className="text-sm font-semibold">{step}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-5 h-full flex flex-col">
                <Database className="h-6 w-6 text-primary" />
                <p className="mt-4 text-lg font-bold">{t("repository.corpusStatus")}</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t("admin.corpusHealth")}
                </p>
                <div className="mt-4 flex flex-col gap-2">
                  <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                    {t("repository.reviewQueue")}
                  </div>
                </div>
                <div className="mt-auto pt-4">
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => setToast(t("admin.configureToast"))}
                  >
                    <FilePlus2 className="h-4 w-4 mr-2" />
                    {t("repository.viewUploadList")}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t("admin.accessModelTitle")}</CardTitle>
              <CardDescription>{t("admin.accessModelDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {accessRoles.map(({ role, detail }) => (
                <div key={role} className="rounded-md border bg-card p-4 transition-colors hover:bg-muted/35">
                  <div className="flex items-center gap-2">
                    <UsersRound className="h-4 w-4 text-primary" />
                    <p className="font-semibold">{role}</p>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
                </div>
              ))}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <p className="mt-4 text-lg font-bold">{t("admin.auditPostureTitle")}</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {t("admin.auditPostureDesc")}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </>
  );
}
