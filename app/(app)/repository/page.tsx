"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FilePlus2, UploadCloud, Search as SearchIcon, Loader2, AlertCircle, FileText, Layers, Folder, Calendar, RefreshCw, WifiOff } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { DocumentCard, DocumentInfo } from "@/components/document-card";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";

const PdfViewer = dynamic(() => import("@/components/pdf-viewer").then(mod => mod.PdfViewer), {
  ssr: false,
});

// ── Curated offline fallback corpus ───────────────────────────────────────────
const OFFLINE_DOCUMENTS: DocumentInfo[] = [
  {
    source_id: "DGMS-CIR-2024-17",
    title: "Inspection Frequency for Conveyor Belt Installations in Mechanised Mines",
    source_type: "Circular",
    category: "Circular",
    publication_date: "2024-03-12",
    synthetic: false,
    chunk_count: 18,
    total_pages: 6,
    has_pdf: false,
    file_size: 312000,
    last_indexed_date: "2026-06-16",
    referenced_by_ai: 14,
  },
  {
    source_id: "CCL-SOP-VT-041",
    title: "Ventilation Quantity Verification and Auxiliary Fan Log Procedure",
    source_type: "SOP",
    category: "SOP",
    publication_date: "2025-01-06",
    synthetic: false,
    chunk_count: 42,
    total_pages: 18,
    has_pdf: false,
    file_size: 890000,
    last_indexed_date: "2026-06-17",
    referenced_by_ai: 9,
  },
  {
    source_id: "DGMS-TECH-NOTE-2023-09",
    title: "PPE Compliance During Blasting, Drilling, Haul Road Maintenance and High-Risk Activities in Mechanised Mines",
    source_type: "Technical Note",
    category: "Technical Note",
    publication_date: "2023-09-18",
    synthetic: false,
    chunk_count: 31,
    total_pages: 12,
    has_pdf: false,
    file_size: 540000,
    last_indexed_date: "2026-06-16",
    referenced_by_ai: 21,
  },
  {
    source_id: "CMR-2017-PART-II",
    title: "Coal Mines Regulations 2017 — Part II: Management and Supervision",
    source_type: "CMR",
    category: "CMR",
    publication_date: "2017-11-01",
    synthetic: false,
    chunk_count: 87,
    total_pages: 44,
    has_pdf: false,
    file_size: 2400000,
    last_indexed_date: "2026-06-15",
    referenced_by_ai: 38,
  },
  {
    source_id: "CCL-AUDIT-PPE-2025-Q1",
    title: "PPE Compliance Audit Report — Q1 2025 (Karo OCP and Amlo Project)",
    source_type: "Audit",
    category: "Audit",
    publication_date: "2025-04-02",
    synthetic: true,
    chunk_count: 24,
    total_pages: 9,
    has_pdf: false,
    file_size: 420000,
    last_indexed_date: "2026-06-18",
    referenced_by_ai: 7,
  },
  {
    source_id: "CCL-SHIFT-JUN-2026",
    title: "Operational Shift Report Corpus — June 2026 (Pilot Areas)",
    source_type: "Shift Report",
    category: "Shift Report",
    publication_date: "2026-06-30",
    synthetic: true,
    chunk_count: 31,
    total_pages: 15,
    has_pdf: false,
    file_size: 670000,
    last_indexed_date: "2026-07-01",
    referenced_by_ai: 5,
  },
];

const KNOWN_CATEGORIES = ["all", "Circular", "Technical Note", "SOP", "CMR", "Audit", "Shift Report"];

export default function RepositoryPage() {
  const { t } = useLanguage();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [sortOption, setSortOption] = useState<"newest" | "oldest" | "alphabetical">("newest");

  const [selectedDoc, setSelectedDoc] = useState<DocumentInfo | null>(null);

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setIsOffline(false);
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        // If backend is offline (503), use offline fallback silently
        if (res.status === 503 || (body?.error && body.error.includes("Cannot connect"))) {
          setDocuments(OFFLINE_DOCUMENTS);
          setIsOffline(true);
        } else {
          throw new Error(body?.error || "Failed to fetch documents");
        }
      } else {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setDocuments(data);
        } else {
          // Backend returned empty list — use offline data as baseline
          setDocuments(OFFLINE_DOCUMENTS);
          setIsOffline(true);
        }
      }
    } catch {
      // Any network error → use offline fallback
      setDocuments(OFFLINE_DOCUMENTS);
      setIsOffline(true);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const stats = useMemo(() => ({
    documents: documents.length,
    pages: documents.reduce((acc, doc) => acc + (doc.total_pages || 0), 0),
    chunks: documents.reduce((acc, doc) => acc + (doc.chunk_count || 0), 0),
    categories: new Set(documents.map(d => d.category)).size,
    lastIndexed: documents.reduce((latest, doc) => {
      if (!doc.last_indexed_date) return latest;
      return latest < doc.last_indexed_date ? doc.last_indexed_date : latest;
    }, ""),
  }), [documents]);

  const filteredAndSortedDocs = useMemo(() => {
    let result = documents;
    if (selectedCategory !== "all") {
      const needle = selectedCategory.toLowerCase();
      result = result.filter(d => {
        const cat = (d.category || "").toLowerCase();
        const type = (d.source_type || "").toLowerCase();
        return cat === needle || cat.includes(needle) || type === needle || type.includes(needle);
      });
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        d => d.title.toLowerCase().includes(q) || d.category.toLowerCase().includes(q) || d.source_id.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      if (sortOption === "alphabetical") return a.title.localeCompare(b.title);
      const dateA = a.publication_date || a.last_indexed_date || "0000";
      const dateB = b.publication_date || b.last_indexed_date || "0000";
      return sortOption === "newest" ? dateB.localeCompare(dateA) : dateA.localeCompare(dateB);
    });
  }, [documents, searchQuery, selectedCategory, sortOption]);


  return (
    <>
      <PageHeader
        eyebrow={t("repository.title")}
        title={t("repository.subtitle")}
        description={t("repository.description")}
        action={
          <Button>
            <UploadCloud className="h-4 w-4" />
            {t("repository.uploadDoc")}
          </Button>
        }
      />
      <div className="container py-6 space-y-6">

        {/* Offline notice */}
        {isOffline && !isLoading && (
          <div className="flex items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span className="flex-1">{t("repository.offlineNotice")}</span>
            <button
              onClick={fetchDocuments}
              className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-100 px-2.5 py-1 text-xs font-semibold hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-900/60 dark:hover:bg-amber-900"
            >
              <RefreshCw className="h-3 w-3" />
              {t("common.retry")}
            </button>
          </div>
        )}

        {/* Error notice (non-503 errors) */}
        {error && !isOffline && (
          <div className="flex items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={fetchDocuments} className="flex items-center gap-1.5 rounded-md border border-destructive/30 px-2.5 py-1 text-xs font-semibold hover:bg-destructive/10">
              <RefreshCw className="h-3 w-3" />
              {t("common.retry")}
            </button>
          </div>
        )}

        {/* Statistics Header */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { icon: FileText, label: t("repository.statDocuments"), value: stats.documents },
            { icon: FilePlus2, label: t("repository.statPages"), value: stats.pages },
            { icon: Layers, label: t("repository.statChunks"), value: stats.chunks },
            { icon: Folder, label: t("repository.statCategories"), value: stats.categories },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label} className="bg-muted/10 border-border/50">
              <CardContent className="p-4 flex flex-col gap-1">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Icon className="w-3.5 h-3.5" /> {label}
                </div>
                <span className="text-xl font-bold">{value}</span>
              </CardContent>
            </Card>
          ))}
          <Card className="bg-muted/10 border-border/50 col-span-2 md:col-span-1">
            <CardContent className="p-4 flex flex-col gap-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" /> {t("repository.statLastIndexed")}
              </div>
              <span className="text-sm font-bold truncate" title={stats.lastIndexed}>{stats.lastIndexed || t("common.noData") || "—"}</span>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Document List */}
        <Card>
          <CardHeader className="pb-3 border-b border-border/50">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <CardTitle>{t("repository.indexedDocs")}</CardTitle>
                  <CardDescription>{t("repository.indexedDocsDesc")}</CardDescription>
                </div>
                <div className="flex gap-3 w-full md:w-auto">
                  <div className="relative w-full md:w-72">
                    <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="search"
                      placeholder={t("repository.filterSearch")}
                      className="pl-9 bg-background w-full"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <select
                    className="flex h-10 items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 min-w-[120px]"
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value as "newest" | "oldest" | "alphabetical")}
                  >
                    <option value="newest">{t("repository.sortNewest")}</option>
                    <option value="oldest">{t("repository.sortOldest")}</option>
                    <option value="alphabetical">{t("repository.sortAZ")}</option>
                  </select>
                </div>
              </div>

              {/* Category Filter Chips */}
              <div className="flex flex-wrap gap-2 pt-2">
                {KNOWN_CATEGORIES.map(cat => {
                  const labelKey = cat === "all" ? "repository.filterAll"
                    : cat === "Circular" ? "repository.catCircular"
                    : cat === "Technical Note" ? "repository.catTechnicalNote"
                    : cat === "SOP" ? "repository.catSOP"
                    : cat === "CMR" ? "repository.catCMR"
                    : cat === "Audit" ? "repository.catAudit"
                    : cat === "Shift Report" ? "repository.catShiftReport"
                    : "repository.filterAll";
                  return (
                    <Badge
                      key={cat}
                      tone={selectedCategory === cat ? "blue" : "neutral"}
                      className={`cursor-pointer hover:bg-primary/20 transition-colors ${selectedCategory === cat ? "ring-2 ring-primary ring-offset-1" : ""}`}
                      onClick={() => setSelectedCategory(cat)}
                    >
                      {t(labelKey)}
                    </Badge>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin mb-4" />
                <p>{t("repository.loading")}</p>
              </div>
            ) : filteredAndSortedDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
                <FilePlus2 className="h-12 w-12 mb-4 opacity-20" />
                <p className="font-medium text-foreground">{t("repository.emptyTitle")}</p>
                <p className="text-sm mt-1">{t("repository.emptyDesc")}</p>
              </div>
            ) : (
              <div className="flex flex-col divide-y">
                {filteredAndSortedDocs.map((doc) => (
                  <DocumentCard
                    key={doc.source_id}
                    document={doc}
                    onView={(d) => setSelectedDoc(d)}
                    searchQuery={searchQuery}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* PDF Viewer Modal */}
      {selectedDoc && (
        <PdfViewer
          sourceId={selectedDoc.source_id}
          title={selectedDoc.title}
          isOpen={true}
          onClose={() => setSelectedDoc(null)}
        />
      )}
    </>
  );
}
