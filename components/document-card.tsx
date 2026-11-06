import React from "react";
import { Eye, Download, BookOpen, Shield, FileText, ClipboardList, Clock, AlertTriangle, Bot } from "lucide-react";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export interface DocumentInfo {
  source_id: string;
  title: string;
  source_type: string;
  category: string;
  publication_date: string;
  synthetic: boolean;
  chunk_count: number;
  total_pages: number;
  has_pdf: boolean;
  file_size: number;
  last_indexed_date: string;
  referenced_by_ai: number;
}

interface DocumentCardProps {
  document: DocumentInfo;
  onView: (document: DocumentInfo) => void;
  searchQuery?: string;
}

function HighlightText({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <span key={i} className="bg-yellow-200 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-100 font-bold px-0.5 rounded-sm">{part}</span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

import { localizeDocText } from "@/lib/i18n/localize";

export const DocumentCard = React.memo(function DocumentCard({ document, onView, searchQuery }: DocumentCardProps) {
  const { t, lang } = useLanguage();

  const getCategoryDetails = (cat: string) => {
    if (cat.includes("Circular") || cat.includes("Regulation") || cat.includes("परिपत्र")) return { tone: "blue", Icon: BookOpen };
    if (cat.includes("SOP") || cat.includes("Guideline") || cat.includes("प्रक्रिया")) return { tone: "green", Icon: FileText };
    if (cat.includes("CMR") || cat.includes("Act") || cat.includes("विनियम")) return { tone: "amber", Icon: Shield };
    if (cat.includes("Report") || cat.includes("रिपोर्ट")) return { tone: "neutral", Icon: ClipboardList };
    if (cat.includes("Inspection") || cat.includes("Emergency") || cat.includes("ऑडिट")) return { tone: "red", Icon: AlertTriangle };
    if (cat.includes("Shift") || cat.includes("Technical") || cat.includes("तकनीकी")) return { tone: "neutral", Icon: Clock };
    return { tone: "blue", Icon: BookOpen };
  };

  const { tone, Icon } = getCategoryDetails(document.category);
  const displayTitle = localizeDocText(document.title, lang);
  const displayCategory = localizeDocText(document.category, lang);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow rounded-none border-x-0 first:border-t-0">
      <CardContent className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        {/* Main Info */}
        <div className="flex-1 space-y-2 w-full">
          <h3 className="font-semibold text-[15px] leading-tight line-clamp-2">
            <HighlightText text={displayTitle} query={searchQuery} />
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tone as "green" | "amber" | "blue" | "red" | "neutral"} className="font-medium text-[11px] h-5 flex items-center gap-1">
              <Icon className="w-3 h-3" />
              {displayCategory}
            </Badge>
            {document.synthetic && (
              <Badge tone="amber" className="font-medium text-[11px] h-5">{t("repository.synthetic")}</Badge>
            )}
            <span className="text-[11px] text-muted-foreground font-mono">
              ID: {document.source_id}
            </span>
          </div>
          <div className="flex flex-wrap items-center text-[12px] text-muted-foreground gap-1.5">
            <span>{t("repository.pages").replace("{n}", String(document.total_pages))}</span>
            <span>•</span>
            <span>{t("repository.chunks").replace("{n}", String(document.chunk_count))}</span>
            <span>•</span>
            <span>{document.last_indexed_date || "—"}</span>
          </div>
          <div className="flex items-center text-[12px] text-primary/80 font-medium">
            <Bot className="w-3.5 h-3.5 mr-1" />
            {t("repository.refsByAI").replace("{n}", String(document.referenced_by_ai || 0))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex sm:flex-col gap-2 w-full sm:w-auto shrink-0 mt-2 sm:mt-0">
          {document.has_pdf && (
            <>
              <Button onClick={() => onView(document)} size="sm" className="w-full sm:w-36 h-8 text-xs" variant="default">
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                {t("actions.viewPdf")}
              </Button>
              <a href={`/api/documents/${document.source_id}/download?lang=${lang}`} download className="w-full sm:w-36">
                <Button variant="outline" size="sm" className="w-full h-8 text-xs">
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  {t("actions.download")}
                </Button>
              </a>
            </>
          )}
          <a href="https://dgms.gov.in/circulars/" target="_blank" rel="noopener noreferrer" className="w-full sm:w-36">
            <Button variant="ghost" size="sm" className="w-full h-8 text-xs text-muted-foreground hover:text-primary">
              <Shield className="w-3.5 h-3.5 mr-1.5" />
              {t("repository.govPortal") || "DGMS Portal"}
            </Button>
          </a>
        </div>
      </CardContent>
    </Card>
  );
});
