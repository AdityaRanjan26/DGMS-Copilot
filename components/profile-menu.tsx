"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  UserRound,
  LogOut,
  Settings,
  Languages,
  Keyboard,
  Info,
  Sun,
  Moon,
  Monitor,
  ChevronRight,
  Shield,
  ShieldCheck,
  Building2,
  KeyRound,
  X,
  Sliders,
  Download,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { useTheme } from "@/components/theme-provider";
import { useAuth } from "@/lib/auth-context";

export function ProfileMenu() {
  const { lang, setLang, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { user, logout, changePassword, setLoginModalOpen } = useAuth();
  
  const [open, setOpen] = useState(false);
  const [subMenu, setSubMenu] = useState<"theme" | "language" | "shortcuts" | null>(null);
  const [mounted, setMounted] = useState(false);

  // Modal States
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [aboutModalOpen, setAboutModalOpen] = useState(false);

  // Password Change state inside Profile modal
  const [pwdCurrent, setPwdCurrent] = useState("");
  const [pwdNew, setPwdNew] = useState("");
  const [pwdMsg, setPwdMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pwdLoading, setPwdLoading] = useState(false);

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSubMenu(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close active modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setProfileModalOpen(false);
        setSettingsModalOpen(false);
        setAboutModalOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const THEMES = [
    { key: "light" as const, label: t("theme.light"), icon: Sun },
    { key: "dark" as const, label: t("theme.dark"), icon: Moon },
    { key: "system" as const, label: t("theme.system"), icon: Monitor },
  ];

  const SHORTCUTS = [
    { key: "⌘K", labelKey: "shortcut_palette" },
    { key: "Enter", labelKey: "shortcut_send" },
    { key: "Shift+Enter", labelKey: "shortcut_newline" },
    { key: "Esc", labelKey: "shortcut_close" },
    { key: "⌘+Shift+H", labelKey: "shortcut_history" },
  ];

  const shortcutLabels: Record<string, string> = {
    shortcut_palette: lang === "hi" ? "कमांड पैलेट" : "Command Palette",
    shortcut_send: lang === "hi" ? "संदेश भेजें" : "Send message",
    shortcut_newline: lang === "hi" ? "नई लाइन" : "New line",
    shortcut_close: lang === "hi" ? "डायलॉग बंद करें" : "Close dialog",
    shortcut_history: lang === "hi" ? "चैट इतिहास" : "Chat history",
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdCurrent || !pwdNew) return;
    setPwdLoading(true);
    setPwdMsg(null);
    try {
      await changePassword(pwdCurrent, pwdNew);
      setPwdMsg({
        type: "success",
        text: lang === "hi" ? "पासवर्ड सफलतापूर्वक अपडेट किया गया!" : "Password updated successfully!",
      });
      setPwdCurrent("");
      setPwdNew("");
    } catch (err: unknown) {
      setPwdMsg({
        type: "error",
        text: err instanceof Error ? err.message : "Password update failed",
      });
    } finally {
      setPwdLoading(false);
    }
  };

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => { setOpen((o) => !o); setSubMenu(null); }}
          className={cn(
            "flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors",
            "bg-card text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            open && "bg-muted"
          )}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={t("profile.title")}
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Shield className="h-3.5 w-3.5" />
          </div>
          <span className="hidden sm:inline">{user?.fullName || t("profile.title")}</span>
        </button>

        {open && (
          <div
            className="animate-fade-in-scale absolute right-0 top-11 z-[9999] w-64 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-black/10 dark:ring-white/10 opacity-100 dark:bg-zinc-950 bg-white"
            role="menu"
            aria-label={t("profile.title")}
          >
            {/* Profile header */}
            <div className="border-b px-4 py-3 bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight">{user?.fullName || t("profile.role")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{user?.mineUnit || t("profile.orgUnit")}</p>
                </div>
              </div>
            </div>

            {!subMenu ? (
              <div className="py-1" role="group">
                <MenuItem
                  icon={UserRound}
                  label={t("profile.menuProfile")}
                  onClick={() => { setOpen(false); setProfileModalOpen(true); }}
                />

                {/* Theme sub-menu trigger */}
                <button
                  onClick={() => setSubMenu("theme")}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                  role="menuitem"
                >
                  <Sun className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">{t("profile.menuTheme")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                {/* Language sub-menu trigger */}
                <button
                  onClick={() => setSubMenu("language")}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                  role="menuitem"
                >
                  <Languages className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">{t("profile.menuLanguage")}</span>
                  <span className="text-xs text-muted-foreground font-medium">
                    {lang === "hi" ? "हिन्दी" : "English"}
                  </span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <button
                  onClick={() => setSubMenu("shortcuts")}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
                  role="menuitem"
                >
                  <Keyboard className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 text-left">{t("profile.menuShortcuts")}</span>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>

                <div className="my-1 border-t" />

                <MenuItem
                  icon={Settings}
                  label={t("profile.menuSettings")}
                  onClick={() => { setOpen(false); setSettingsModalOpen(true); }}
                />
                <MenuItem
                  icon={Info}
                  label={t("profile.menuAbout")}
                  onClick={() => { setOpen(false); setAboutModalOpen(true); }}
                />

                <div className="my-1 border-t" />

                <button
                  onClick={() => { setOpen(false); logout(); setLoginModalOpen(true); }}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  {t("profile.menuLogout")}
                </button>
              </div>
            ) : subMenu === "theme" ? (
              <div className="py-1">
                <SubMenuHeader label={t("profile.menuTheme")} onBack={() => setSubMenu(null)} />
                {THEMES.map(({ key, label, icon: Icon }) => (
                  <button
                    key={key}
                    onClick={() => { setTheme(key); setSubMenu(null); }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted",
                      theme === key ? "text-primary font-semibold" : "text-foreground"
                    )}
                    role="menuitemradio"
                    aria-checked={theme === key}
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {label}
                    {theme === key && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            ) : subMenu === "language" ? (
              <div className="py-1">
                <SubMenuHeader label={t("profile.menuLanguage")} onBack={() => setSubMenu(null)} />
                {(["hi", "en"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => { setLang(l); setSubMenu(null); }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted",
                      lang === l ? "text-primary font-semibold" : "text-foreground"
                    )}
                    role="menuitemradio"
                    aria-checked={lang === l}
                  >
                    <Languages className="h-4 w-4 text-muted-foreground" />
                    {l === "hi" ? "हिन्दी" : "English"}
                    {lang === l && (
                      <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-1">
                <SubMenuHeader label={t("profile.menuShortcuts")} onBack={() => setSubMenu(null)} />
                <div className="px-4 py-2 space-y-2">
                  {SHORTCUTS.map(({ key, labelKey }) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{shortcutLabels[labelKey]}</span>
                      <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Modal 1: View Profile ────────────────────────────────────────────── */}
      {mounted && profileModalOpen && createPortal(
        <div
          onClick={() => setProfileModalOpen(false)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base">{lang === "hi" ? "अधिकारी प्रोफ़ाइल" : "Officer Profile Credentials"}</h3>
                  <p className="text-xs text-muted-foreground">{lang === "hi" ? "खान सुरक्षा महानिदेशालय — प्रमाणीकरण" : "Directorate General of Mines Safety — Enterprise Authentication"}</p>
                </div>
              </div>
              <button
                onClick={() => setProfileModalOpen(false)}
                className="rounded-lg p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{lang === "hi" ? "अधिकारी नाम" : "Officer Name"}</span>
                  <span className="text-sm font-bold">{user?.fullName}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-xs font-medium text-muted-foreground">{lang === "hi" ? "आधिकारिक ईमेल" : "Official Email"}</span>
                  <span className="text-xs font-mono font-semibold">{user?.email}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-xs font-medium text-muted-foreground">{lang === "hi" ? "सुरक्षा स्तर" : "Security Level"}</span>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{user?.securityLevel}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2">
                  <span className="text-xs font-medium text-muted-foreground">{lang === "hi" ? "नियोजित इकाई" : "Deployment Unit"}</span>
                  <span className="text-xs font-semibold">{user?.mineUnit}</span>
                </div>
              </div>

              {/* Password change section */}
              <form onSubmit={handlePasswordSubmit} className="space-y-3 rounded-lg border p-4">
                <div className="flex items-center gap-2 font-semibold text-sm">
                  <KeyRound className="h-4 w-4 text-primary" />
                  {lang === "hi" ? "पासवर्ड अपडेट करें" : "Update Password"}
                </div>
                {pwdMsg && (
                  <div className={cn("rounded-md p-2.5 text-xs font-medium", pwdMsg.type === "success" ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20" : "bg-destructive/10 text-destructive border border-destructive/20")}>
                    {pwdMsg.text}
                  </div>
                )}
                <div className="space-y-2">
                  <input
                    type="password"
                    placeholder={lang === "hi" ? "वर्तमान पासवर्ड दर्ज करें" : "Current password"}
                    value={pwdCurrent}
                    onChange={(e) => setPwdCurrent(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                  />
                  <input
                    type="password"
                    placeholder={lang === "hi" ? "नया सुरक्षित पासवर्ड (न्यूनतम 8 वर्ण)" : "New password (min 8 characters)"}
                    value={pwdNew}
                    onChange={(e) => setPwdNew(e.target.value)}
                    className="w-full rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                    required
                    minLength={8}
                  />
                </div>
                <button
                  type="submit"
                  disabled={pwdLoading}
                  className="w-full rounded-md bg-primary py-2 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 disabled:opacity-50"
                >
                  {pwdLoading ? (lang === "hi" ? "अपडेट हो रहा है..." : "Updating...") : (lang === "hi" ? "पासवर्ड सहेजें" : "Save Password")}
                </button>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal 2: Settings ────────────────────────────────────────────── */}
      {mounted && settingsModalOpen && createPortal(
        <div
          onClick={() => setSettingsModalOpen(false)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">{lang === "hi" ? "सिस्टम सेटिंग्स" : "System Settings"}</h3>
                  <p className="text-xs text-muted-foreground">{lang === "hi" ? "इंटरफ़ेस और सुरक्षा प्राथमिकताएं" : "UI Preferences & Security Controls"}</p>
                </div>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="rounded-lg p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{lang === "hi" ? "इंटरफ़ेस भाषा" : "Interface Language"}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setLang("hi")}
                    className={cn("flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-semibold transition-all", lang === "hi" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
                  >
                    हिन्दी (Devanagari)
                  </button>
                  <button
                    onClick={() => setLang("en")}
                    className={cn("flex items-center justify-center gap-2 rounded-lg border p-3 text-xs font-semibold transition-all", lang === "en" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}
                  >
                    English (US/UK)
                  </button>
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{lang === "hi" ? "सुरक्षा सत्र समयबद्धता" : "Security Session Timeout"}</label>
                <select className="w-full rounded-md border bg-background p-2 text-xs font-medium">
                  <option>{lang === "hi" ? "15 मिनट (अधिकतम सुरक्षा)" : "15 Minutes (Maximum Security)"}</option>
                  <option>{lang === "hi" ? "30 मिनट (मानक)" : "30 Minutes (Standard)"}</option>
                  <option>{lang === "hi" ? "60 मिनट" : "60 Minutes"}</option>
                </select>
              </div>

              <div className="space-y-2 border-t pt-4">
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{lang === "hi" ? "AI RAG मॉडल तापमान" : "AI RAG Model Precision"}</label>
                <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20 text-xs">
                  <span>{lang === "hi" ? "सख्त तथ्यपरक (0.15 Temperature)" : "Strict Factual (0.15 Temperature)"}</span>
                  <span className="font-bold text-emerald-600">सक्रिय</span>
                </div>
              </div>

              <div className="border-t pt-4">
                <button
                  onClick={() => alert(lang === "hi" ? "सुरक्षा ऑडिट लॉग क्लिपबोर्ड पर निर्यात किया गया!" : "Security audit log exported!")}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 py-2.5 text-xs font-bold text-primary hover:bg-primary/10"
                >
                  <Download className="h-4 w-4" />
                  {lang === "hi" ? "सुरक्षा ऑडिट लॉग डाउनलोड करें" : "Download Security Audit Log"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Modal 3: About DGMS Copilot ────────────────────────────────────────────── */}
      {mounted && aboutModalOpen && createPortal(
        <div
          onClick={() => setAboutModalOpen(false)}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg max-h-[85vh] overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between border-b px-6 py-4 bg-muted/40 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base">DGMS Copilot Enterprise</h3>
                  <p className="text-xs text-muted-foreground">Version 2.4.0 — National Mine Safety AI Platform</p>
                </div>
              </div>
              <button
                onClick={() => setAboutModalOpen(false)}
                className="rounded-lg p-2 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs leading-relaxed">
              <div className="rounded-lg border bg-primary/5 p-4 space-y-2 border-primary/20">
                <div className="flex items-center gap-2 font-bold text-sm text-primary">
                  <ShieldCheck className="h-4 w-4" />
                  {lang === "hi" ? "भारत सरकार — अनुपालन मंच" : "Government of India — Compliance Platform"}
                </div>
                <p className="text-muted-foreground">
                  {lang === "hi"
                    ? "DGMS Copilot सेन्ट्रल कोलफील्ड्स लिमिटेड (CCL) और खान सुरक्षा महानिदेशालय (DGMS) के लिए एक सुरक्षित, नियंत्रित AI अनुपालन मंच है।"
                    : "DGMS Copilot is a secure, enterprise-grade AI compliance platform designed for Central Coalfields Limited (CCL) and the Directorate General of Mines Safety (DGMS)."}
                </p>
              </div>

              <div className="space-y-2 border-t pt-3">
                <div className="flex justify-between font-semibold">
                  <span>{lang === "hi" ? "सुरक्षा मानक:" : "Security Standard:"}</span>
                  <span className="text-emerald-600 font-bold">PBKDF2 / AES-256 Encrypted</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{lang === "hi" ? "RAG कॉर्पस स्थिति:" : "RAG Corpus Status:"}</span>
                  <span className="font-bold">18 Indexed Regulation Datasets</span>
                </div>
                <div className="flex justify-between font-semibold">
                  <span>{lang === "hi" ? "ऑडिट ट्रेल:" : "Audit Trail:"}</span>
                  <span className="font-bold text-emerald-600">SQLite WAL Active (50 Log Buffer)</span>
                </div>
              </div>

              <div className="border-t pt-3 text-[11px] text-muted-foreground">
                {lang === "hi"
                  ? "© 2026 खान सुरक्षा महानिदेशालय (DGMS), धनबाद एवं CCL रांची। सर्वाधिकार सुरक्षित।"
                  : "© 2026 Directorate General of Mines Safety (DGMS), Dhanbad & CCL Ranchi. All rights reserved."}
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
      role="menuitem"
    >
      <Icon className="h-4 w-4 text-muted-foreground" />
      {label}
    </button>
  );
}

function SubMenuHeader({
  label,
  onBack,
}: {
  label: string;
  onBack: () => void;
}) {
  return (
    <button
      onClick={onBack}
      className="flex w-full items-center gap-2 border-b px-4 py-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronRight className="h-3.5 w-3.5 rotate-180" />
      {label}
    </button>
  );
}
