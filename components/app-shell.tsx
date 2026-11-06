"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Menu, Search, X } from "lucide-react";
import { navigation } from "@/lib/platform-data";
import { isAdmin } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { NotificationCenter } from "@/components/notification-center";
import { ProfileMenu } from "@/components/profile-menu";
import { CommandPalette } from "@/components/command-palette";
import { useEffect, useState } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Filter admin-only nav items for non-admin roles
  const visibleNav = navigation.filter((item) => !item.adminOnly || isAdmin());

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Cmd+K / Ctrl+K → Command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
      // Escape → close palette / mobile nav
      if (e.key === "Escape") {
        setPaletteOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Close mobile nav on route change
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Command Palette ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {paletteOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              className="palette-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setPaletteOpen(false)}
              aria-hidden="true"
            />
            {/* Palette */}
            <div className="fixed inset-x-4 top-0 z-[9001] flex justify-center sm:inset-x-0">
              <CommandPalette onClose={() => setPaletteOpen(false)} />
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          {/* Logo + title */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
            aria-label="DGMS-Copilot Dashboard"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
              <Building2 className="h-4.5 w-4.5" />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-bold leading-tight tracking-tight">{t("shell.title")}</p>
              <p className="text-[10px] text-muted-foreground">{t("shell.subtitle")}</p>
            </div>
          </Link>

          {/* Global search bar (opens command palette) */}
          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden w-full max-w-xs items-center gap-2 rounded-md border bg-muted/50 px-3 py-1.5 md:flex text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Open command palette"
          >
            <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="flex-1 text-sm text-muted-foreground">{t("shell.search")}</span>
            <kbd className="shrink-0 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          {/* Right controls */}
          <div className="flex items-center gap-1.5">
            {/* Mobile search */}
            <button
              onClick={() => setPaletteOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications */}
            <NotificationCenter />

            {/* Profile menu */}
            <ProfileMenu />

            {/* Mobile menu toggle */}
            <button
              className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileNavOpen}
              aria-controls="mobile-nav"
              onClick={() => setMobileNavOpen((o) => !o)}
            >
              {mobileNavOpen ? <X className="h-4.5 w-4.5" /> : <Menu className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* Mobile navigation */}
        <AnimatePresence>
          {mobileNavOpen && (
            <motion.nav
              id="mobile-nav"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="overflow-hidden border-t bg-background lg:hidden"
              role="navigation"
              aria-label="Mobile navigation"
            >
              <div className="grid grid-cols-2 gap-1 p-3">
                {visibleNav.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{t(`nav.${item.label.toLowerCase()}`)}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="flex">
        {/* ── Left Sidebar ───────────────────────────────────────────────────── */}
        <aside
          className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto lg:block scrollbar-thin"
          style={{ background: "hsl(var(--sidebar-bg))", borderRight: "1px solid hsl(var(--sidebar-border))" }}
          aria-label="Main navigation"
        >
          <nav className="space-y-0.5 p-3" role="navigation">
            {visibleNav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "sidebar-nav-item relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium",
                    active
                      ? "active bg-[hsl(var(--sidebar-active))]/20 text-[hsl(var(--sidebar-fg))]"
                      : "text-[hsl(var(--sidebar-muted))] hover:bg-[hsl(var(--sidebar-hover))] hover:text-[hsl(var(--sidebar-fg))]"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-indicator"
                      className="absolute inset-0 rounded-md bg-[hsl(var(--sidebar-active))]/20"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className={cn(
                      "relative h-4 w-4 shrink-0",
                      active
                        ? "text-[hsl(var(--sidebar-active))]"
                        : "text-[hsl(var(--sidebar-muted))]"
                    )}
                  />
                  <span className="relative truncate">
                    {t(`nav.${item.label.toLowerCase()}`)}
                  </span>
                  {active && (
                    <span
                      className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full bg-[hsl(var(--sidebar-active))]"
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>


        {/* ── Main content ─────────────────────────────────────────────────── */}
        <main className="w-full min-w-0 flex-1">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
