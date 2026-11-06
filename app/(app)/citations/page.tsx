"use client";

import { Link2, SearchCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { citations } from "@/lib/platform-data";
import { useLanguage } from "@/lib/i18n/LanguageContext";

import { localizeDocText } from "@/lib/i18n/localize";

export default function CitationsPage() {
  const { t, lang } = useLanguage();

  return (
    <>
      <PageHeader
        eyebrow={t("nav.traceability")}
        title={t("citations.title")}
        description={t("citations.description")}
        action={
          <Button variant="outline">
            <SearchCheck className="h-4 w-4" />
            {t("citations.verifyAnswer")}
          </Button>
        }
      />
      <div className="container grid gap-6 py-6 xl:grid-cols-[380px_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{t("citations.chainTitle")}</CardTitle>
            <CardDescription>{t("citations.chainDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {citations.map((citation, index) => (
              <div key={citation.ref} className="rounded-md border bg-card p-4 transition-colors hover:bg-muted/35">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary text-xs font-bold text-primary-foreground">
                    {index + 1}
                  </div>
                  <Badge tone="blue">{localizeDocText(citation.ref, lang)}</Badge>
                </div>
                <p className="mt-3 text-sm font-semibold">{localizeDocText(citation.title, lang)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>{t("citations.excerptTitle")}</CardTitle>
                <CardDescription>{t("citations.excerptDesc")}</CardDescription>
              </div>
              <Button>
                <Link2 className="h-4 w-4" />
                {t("citations.copyLink")}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {citations.map((citation) => (
              <section key={citation.ref} className="rounded-md border bg-card p-5 transition-colors hover:bg-muted/25">
                <Badge tone="green">{localizeDocText(citation.ref, lang)}</Badge>
                <p className="mt-3 text-lg font-bold">{localizeDocText(citation.title, lang)}</p>
                <blockquote className="mt-4 border-l-4 border-ccl-gold bg-secondary/40 p-4 text-sm leading-6">
                  {localizeDocText(citation.quote, lang)}
                </blockquote>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">{localizeDocText(citation.answerUse, lang)}</p>
              </section>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
