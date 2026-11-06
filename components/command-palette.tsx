"use client";

import { useEffect, useRef, useState } from "react";
import { Search, ArrowRight, LayoutDashboard, MessageSquare, FolderOpen, Zap, FileText, Shield, Clock, TrendingUp, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ElementType;
  href?: string;
  action?: () => void;
  category: string;
}

const RECENT_SEARCHES_KEY = "dgms-recent-searches";

function getRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentSearch(query: string) {
  const recent = getRecentSearches();
  const updated = [query, ...recent.filter((s) => s !== query)].slice(0, 8);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
}

const POPULAR_QUERIES = [
  "Conveyor belt inspection frequency",
  "PPE requirements for underground mines",
  "DGMS circular on haul road speed limits",
  "Ventilation standards for coal mines",
  "Fire extinguisher maintenance rules",
  "Pull cord check before shift",
  "Blasting safety procedures",
  "Emergency evacuation plan",
];

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const NAV_ITEMS: CommandItem[] = [
    { id: "dashboard", label: t("nav.dashboard"), icon: LayoutDashboard, href: "/dashboard", category: "Navigate" },
    { id: "assistant", label: t("nav.assistant"), icon: MessageSquare, href: "/assistant", category: "Navigate" },
    { id: "repository", label: t("nav.knowledge repository"), icon: FolderOpen, href: "/repository", category: "Navigate" },
    { id: "search", label: t("nav.dgms search"), icon: Search, href: "/search", category: "Navigate" },
    { id: "citations", label: t("nav.traceability"), icon: Zap, href: "/citations", category: "Navigate" },
    { id: "reports", label: t("nav.operational reports"), icon: FileText, href: "/shift-analysis", category: "Navigate" },
    { id: "governance", label: t("nav.governance"), icon: Shield, href: "/admin", category: "Navigate" },
  ];

  const recent = getRecentSearches();

  // Filtered items
  const q = query.trim().toLowerCase();
  const filteredNav = q
    ? NAV_ITEMS.filter(
        (i) =>
          i.label.toLowerCase().includes(q) ||
          (i.description || "").toLowerCase().includes(q)
      )
    : NAV_ITEMS;

  const filteredPopular = q
    ? POPULAR_QUERIES.filter((s) => s.toLowerCase().includes(q))
    : POPULAR_QUERIES.slice(0, 5);

  const filteredRecent = q
    ? recent.filter((s) => s.toLowerCase().includes(q))
    : recent.slice(0, 5);

  // All items for keyboard navigation
  const allItems: Array<{ type: "nav" | "popular" | "recent" | "search"; value: string; href?: string }> = [
    ...(q ? [{ type: "search" as const, value: query, href: `/search?q=${encodeURIComponent(query)}` }] : []),
    ...filteredRecent.map((s) => ({ type: "recent" as const, value: s, href: `/search?q=${encodeURIComponent(s)}` })),
    ...filteredNav.map((i) => ({ type: "nav" as const, value: i.label, href: i.href })),
    ...filteredPopular.map((s) => ({ type: "popular" as const, value: s, href: `/search?q=${encodeURIComponent(s)}` })),
  ];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  function navigate(href: string | undefined, isSearch = false) {
    if (!href) return;
    if (isSearch && query.trim()) addRecentSearch(query.trim());
    onClose();
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, allItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = allItems[selected];
      if (item) navigate(item.href, item.type === "search");
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  return (
    <div
      className="animate-fade-in-scale mx-auto mt-[12vh] w-full max-w-xl overflow-hidden rounded-xl border border-border bg-white dark:bg-zinc-950 text-foreground shadow-2xl opacity-100 ring-1 ring-black/10 dark:ring-white/10"
      role="dialog"
      aria-modal="true"
      aria-label={t("commandPalette.placeholder")}
    >
      {/* Search input */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-white dark:bg-zinc-950">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={t("commandPalette.placeholder")}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          aria-autocomplete="list"
          role="combobox"
          aria-expanded="true"
          aria-controls="command-palette-listbox"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="rounded p-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear query"
          >
            ✕
          </button>
        )}
        <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground select-none">
          esc
        </kbd>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors ml-0.5"
          aria-label="Close search"
          title="Close (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Results */}
      <div className="max-h-[420px] overflow-y-auto py-2 scrollbar-thin" role="listbox">
        {/* "Search for…" option when typing */}
        {q && (
          <div className="px-2">
            <button
              onClick={() => navigate(`/search?q=${encodeURIComponent(query)}`, true)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                selected === 0 ? "bg-primary text-primary-foreground" : "hover:bg-muted"
              )}
            >
              <Search className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">
                Search corpus for <strong>&ldquo;{query}&rdquo;</strong>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
            </button>
          </div>
        )}

        {/* Recent searches */}
        {filteredRecent.length > 0 && (
          <Section label={t("commandPalette.recentSearches")}>
            {filteredRecent.map((s, i) => {
              const idx = (q ? 1 : 0) + i;
              return (
                <SectionItem
                  key={s}
                  icon={Clock}
                  label={s}
                  selected={selected === idx}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(s)}`)}
                />
              );
            })}
          </Section>
        )}

        {/* Navigation */}
        {filteredNav.length > 0 && (
          <Section label={t("commandPalette.navigate")}>
            {filteredNav.map((item, i) => {
              const Icon = item.icon;
              const offset = (q ? 1 : 0) + filteredRecent.length + i;
              return (
                <SectionItem
                  key={item.id}
                  icon={Icon}
                  label={item.label}
                  selected={selected === offset}
                  onClick={() => navigate(item.href)}
                />
              );
            })}
          </Section>
        )}

        {/* Popular queries */}
        {filteredPopular.length > 0 && (
          <Section label={t("commandPalette.popularQueries")}>
            {filteredPopular.map((s, i) => {
              const offset = (q ? 1 : 0) + filteredRecent.length + filteredNav.length + i;
              return (
                <SectionItem
                  key={s}
                  icon={TrendingUp}
                  label={s}
                  selected={selected === offset}
                  onClick={() => navigate(`/search?q=${encodeURIComponent(s)}`)}
                />
              );
            })}
          </Section>
        )}

        {allItems.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">{t("commandPalette.noResults")}</p>
            <p className="mt-1 text-xs text-muted-foreground/60">{t("commandPalette.noResultsHint")}</p>
          </div>
        )}
      </div>

      <div className="border-t px-4 py-2 text-center text-[10px] text-muted-foreground/60">
        {t("commandPalette.tipHint")}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-2 py-1">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
        {label}
      </p>
      {children}
    </div>
  );
}

function SectionItem({
  icon: Icon,
  label,
  selected,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
        selected ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted"
      )}
      role="option"
      aria-selected={selected}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-left">{label}</span>
      {selected && <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" />}
    </button>
  );
}
