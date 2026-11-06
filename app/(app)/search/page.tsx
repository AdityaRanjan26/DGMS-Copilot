"use client";

import { useState } from "react";
import Link from "next/link";
import { Filter, Search, Loader2, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { localizeDocText } from "@/lib/i18n/localize";

// ─── Types ───────────────────────────────────────────────────────────────────

interface SearchResultItem {
  id: string;
  title: string;
  type: string;
  score: string;
  excerpt: string;
  section: string;
  date: string;
  owner: string;
  mineContext: string;
  synthetic: boolean;
  raw_score: number;
}

// Quick-filter tags — clicking one pre-fills the search box
const QUICK_TAGS_KEYS = [
  { key: "search.tagConveyor", en: "Conveyor belt inspection" },
  { key: "search.tagVentilation", en: "Ventilation standards" },
  { key: "search.tagPPE", en: "PPE compliance" },
  { key: "search.tagBlasting", en: "Blasting safety" },
  { key: "search.tagHaulRoad", en: "Haul road speed" },
  { key: "search.tagSOP", en: "Standard Operating Procedure" },
];

// Score → badge tone
function scoreTone(score: string): "blue" | "green" | "amber" {
  if (score === "High") return "green";
  if (score === "Medium") return "amber";
  return "blue";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchPage() {
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [totalIndexed, setTotalIndexed] = useState<number | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    const q = query.trim();
    if (!q || isLoading) return;

    setError(null);
    setSummary(null);
    setIsLoading(true);
    setHasSearched(true);

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, n_results: 8 }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Search failed.");
      }

      setResults(data.results ?? []);
      setTotalIndexed(data.total ?? 0);
      setSummary(data.summary ?? null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setResults([]);
      setSummary(null);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSearch();
  }

  function handleTagClick(tag: string) {
    setQuery(tag);
  }

  return (
    <>
      <PageHeader
        eyebrow={t("search.title")}
        title={t("search.subtitle")}
        description={t("search.description")}
        action={
          <Button variant="outline">
            <Filter className="h-4 w-4" />
            {t("search.filters")}
          </Button>
        }
      />
      <div className="container space-y-6 py-6">
        <Card>
          <CardContent className="p-5">
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t("search.placeholder")}
                />
              </div>
              <Button onClick={handleSearch} disabled={isLoading || !query.trim()}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {t("search.btnSearch")}
              </Button>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {QUICK_TAGS_KEYS.map((tag) => (
                <button key={tag.key} onClick={() => handleTagClick(lang === "hi" ? t(tag.key) : tag.en)}>
                  <Badge className="cursor-pointer">{lang === "hi" ? t(tag.key) : tag.en}</Badge>
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-md border bg-muted/35 p-3 text-sm text-muted-foreground">
              {hasSearched && totalIndexed !== null
                ? t("search.scopeCount", { count: totalIndexed })
                : t("search.scopeAll")}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center gap-3 py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">{t("search.searching")}</span>
          </div>
        )}

        {!isLoading && summary && (
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4 text-primary" />
                {t("search.aiSummary")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm leading-6 whitespace-pre-wrap">{localizeDocText(summary, lang)}</div>
            </CardContent>
          </Card>
        )}

        {!isLoading && results.length > 0 && (
          <div className="grid gap-4">
            {results.map((result) => {
              const localizedTitle = localizeDocText(result.title, lang);
              const localizedType = localizeDocText(result.type, lang);
              const localizedOwner = localizeDocText(result.owner, lang);
              const localizedExcerpt = localizeDocText(result.excerpt, lang);
              const localizedSection = localizeDocText(result.section, lang);
              const localizedScore = lang === "hi"
                ? (result.score === "High" ? "उच्च" : result.score === "Medium" ? "मध्यम" : "कम")
                : result.score;

              return (
                <Card key={`${result.id}-${result.section}`} className="transition-colors hover:border-primary/40 hover:bg-muted/30">
                  <CardHeader>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone="blue">{localizedType}</Badge>
                          <Badge tone={scoreTone(result.score)}>{t("search.match", { score: localizedScore })}</Badge>
                          <span className="text-xs font-semibold text-muted-foreground">{result.id}</span>
                          {result.synthetic && (
                            <Badge tone="amber">{t("search.synthetic")}</Badge>
                          )}
                        </div>
                        <CardTitle className="mt-3">{localizedTitle}</CardTitle>
                        <CardDescription className="mt-2">
                          {result.date} · {localizedOwner}
                        </CardDescription>
                      </div>
                      <Link href="/citations">
                        <Button variant="outline">{t("search.openTraceability")}</Button>
                      </Link>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="rounded-md border-l-4 border-ccl-gold bg-secondary/45 p-4 text-sm leading-6">
                      {localizedExcerpt}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground italic">
                      {localizedSection && `${localizedSection} · `}{result.mineContext}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {!isLoading && hasSearched && results.length === 0 && !error && (
          <div className="rounded-lg border border-dashed p-12 text-center">
            <p className="font-semibold text-muted-foreground">{t("search.noResults")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("search.tryDifferent")}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
