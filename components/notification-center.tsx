"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Bell,
  CheckCheck,
  AlertTriangle,
  Info,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  FileText,
  Cpu,
  X,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n/LanguageContext";

interface Notification {
  id: string;
  type: "system" | "repository" | "compliance" | "report" | "assistant";
  title: string;
  message: string;
  titleKey?: string;
  messageKey?: string;
  timestamp: number;
  read: boolean;
  archived: boolean;
  severity: "info" | "warning" | "critical" | "success";
  action_url?: string;
  action_label?: string;
  action_label_key?: string;
}

const SEVERITY_ICONS = {
  info: <Info className="h-4 w-4 text-blue-500" />,
  warning: <AlertTriangle className="h-4 w-4 text-amber-500" />,
  critical: <AlertCircle className="h-4 w-4 text-red-500" />,
  success: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
};

const TYPE_ICONS = {
  system: <Cpu className="h-3.5 w-3.5" />,
  repository: <FolderOpen className="h-3.5 w-3.5" />,
  compliance: <AlertTriangle className="h-3.5 w-3.5" />,
  report: <FileText className="h-3.5 w-3.5" />,
  assistant: <Info className="h-3.5 w-3.5" />,
};

function localizeNotificationText(text: string, targetLang: string): string {
  if (targetLang !== "hi" || !text) return text;
  return text
    .replace(/DGMS Circular Update/g, "DGMS परिपत्र अद्यतन")
    .replace(/DGMS-CIR-2024-22 on Conveyor Belt Safety has been indexed and is available in the repository\./g, "कन्वेयर बेल्ट सुरक्षा पर DGMS-CIR-2024-22 अनुक्रमित किया गया है और रिपॉजिटरी में उपलब्ध है।")
    .replace(/Shift Report Anomaly Detected/g, "शिफ्ट रिपोर्ट विसंगति पाई गई")
    .replace(/Karo OCP Night Shift \(June 14\) reported 3 PPE non-compliance incidents requiring follow-up\./g, "करो ओसीपी नाइट शिफ्ट (14 जून) ने 3 पीपीई गैर-अनुपालन घटनाओं की सूचना दी, जिसके लिए फॉलो-अप आवश्यक है।")
    .replace(/Night Shift \(June 14\) reported 3 PPE non-compliance incidents requiring follow-up\./g, "नाइट शिफ्ट (14 जून) ने 3 पीपीई गैर-अनुपालन घटनाओं की सूचना दी।")
    .replace(/Repository Indexed/g, "रिपॉजिटरी अनुक्रमित")
    .replace(/42 new document chunks indexed from CCL SOPs batch upload\. Corpus is up to date\./g, "CCL SOPs बैच अपलोड से 42 नए दस्तावेज़ खंड अनुक्रमित किए गए। कॉर्पस अद्यतन है।")
    .replace(/Compliance Alert: Haul Road Speed/g, "अनुपालन चेतावनी: हॉल रोड गति")
    .replace(/Pending action: Haul road speed limit compliance below 85% at Piparwar OCP\. Inspection due\./g, "लंबित कार्रवाई: पिपरवार ओसीपी पर हॉल रोड गति सीमा अनुपालन 85% से नीचे है। निरीक्षण देय।")
    .replace(/B Shift ventilation entry delayed/g, "B शिफ्ट वेंटिलेशन प्रविष्टि में देरी")
    .replace(/Panel 3A register update breached the configured pre-deployment rule\. Review required before next shift\./g, "पैनल 3A रजिस्टर अद्यतन ने पूर्व-तैनाती नियम का उल्लंघन किया। समीक्षा आवश्यक।")
    .replace(/6 new DGMS references indexed/g, "6 नए DGMS संदर्भ अनुक्रमित")
    .replace(/Knowledge repository now exposes searchable clause-level citations from the latest circulars\./g, "ज्ञान रिपॉजिटरी अब नवीनतम परिपत्रों से खोज योग्य क्लॉज़-स्तरीय उद्धरण प्रदर्शित करती है।")
    .replace(/Conveyor inspection rate improved/g, "कन्वेयर निरीक्षण दर में सुधार")
    .replace(/Karo OCP closure rate improved from 88% to 94% across recent shift checks\./g, "हाल ही में शिफ्ट जांचों में करो ओसीपी बंद होने की दर 88% से बढ़कर 94% हो गई।")
    .replace(/Platform running in offline mode/g, "प्लेटफॉर्म ऑफ़लाइन मोड में चल रहा है")
    .replace(/The DGMS Copilot backend is not reachable\. Document search and assistant features require the Python server\./g, "DGMS Copilot बैकएंड पहुंच योग्य नहीं है। दस्तावेज़ खोज और सहायक सुविधाओं के लिए Python सर्वर आवश्यक है।")
    .replace(/View Document/g, "दस्तावेज़ देखें")
    .replace(/View Report/g, "रिपोर्ट देखें")
    .replace(/Browse Documents/g, "दस्तावेज़ ब्राउज़ करें")
    .replace(/Search Regulations/g, "विनियम खोजें")
    .replace(/Review Report/g, "रिपोर्ट की समीक्षा करें")
    .replace(/View Repository/g, "रिपॉजिटरी देखें")
    .replace(/View Dashboard/g, "डैशबोर्ड देखें")
    .replace(/Karo OCP/g, "करो ओसीपी")
    .replace(/Amlo Project/g, "आम्लो परियोजना");
}

function makeTimeAgo(t: (key: string, params?: Record<string, string | number>) => string) {
  return function timeAgo(ts: number): string {
    const diff = Math.floor((Date.now() - ts * 1000) / 1000);
    if (diff < 60) return t("notifications.justNow");
    if (diff < 3600) return t("notifications.minutesAgo", { n: Math.floor(diff / 60) });
    if (diff < 86400) return t("notifications.hoursAgo", { n: Math.floor(diff / 3600) });
    return t("notifications.daysAgo", { n: Math.floor(diff / 86400) });
  };
}

export function NotificationCenter() {
  const { t, lang } = useLanguage();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const panelRef = useRef<HTMLDivElement>(null);

  const timeAgo = makeTimeAgo(t);

  const TYPE_LABELS: Record<string, string> = {
    system: t("notifications.filterSystem"),
    repository: t("notifications.filterRepository"),
    compliance: t("notifications.filterCompliance"),
    report: t("notifications.filterReports"),
    assistant: t("nav.assistant"),
  };

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        const data = await res.json();
        setNotifications(data);
      }
    } catch {
      // Backend offline — use empty list
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30_000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const unread = notifications.filter((n) => !n.read && !n.archived).length;

  const filtered =
    filter === "all"
      ? notifications.filter((n) => !n.archived)
      : notifications.filter((n) => !n.archived && n.type === filter);

  async function markAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", ids: null }),
      });
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  async function dismiss(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", ids: [id] }),
      });
    } catch {}
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  async function markRead(id: string) {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read", ids: [id] }),
      });
    } catch {}
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }

  const FILTERS = [
    { key: "all", label: t("notifications.filterAll") },
    { key: "compliance", label: t("notifications.filterCompliance") },
    { key: "report", label: t("notifications.filterReports") },
    { key: "repository", label: t("notifications.filterRepository") },
    { key: "system", label: t("notifications.filterSystem") },
  ];

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => {
          setOpen((o) => !o);
          if (!open) fetchNotifications();
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${t("notifications.title")} ${unread > 0 ? `(${unread} unread)` : ""}`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white"
            aria-hidden="true"
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          className="animate-fade-in-scale absolute right-0 top-11 z-[9999] w-96 overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl ring-1 ring-black/10 dark:ring-white/10 opacity-100 dark:bg-zinc-950 bg-white"
          role="dialog"
          aria-label={t("notifications.title")}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="text-sm font-semibold">{t("notifications.title")}</h3>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={t("notifications.markAllRead")}
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {t("notifications.markAllRead")}
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label={t("common.close")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 overflow-x-auto border-b px-3 py-2 scrollbar-thin">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Notification list */}
          <div className="max-h-96 divide-y overflow-y-auto scrollbar-thin">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bell className="mb-3 h-8 w-8 text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">
                  {t("notifications.empty")}
                </p>
                <p className="text-xs text-muted-foreground/70">
                  {t("notifications.emptyDesc")}
                </p>
              </div>
            ) : (
              filtered.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
                    "group relative cursor-pointer px-4 py-3 transition-colors hover:bg-muted/50",
                    !n.read && "bg-primary/[0.03]"
                  )}
                >
                  {!n.read && (
                    <span className="absolute left-2 top-4 h-1.5 w-1.5 rounded-full bg-primary" />
                  )}
                  <div className="flex items-start gap-3 pl-2">
                    <div className="mt-0.5 shrink-0">{SEVERITY_ICONS[n.severity]}</div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-tight text-foreground line-clamp-1">
                        {n.titleKey ? t(n.titleKey) : localizeNotificationText(n.title, lang)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
                        {n.messageKey ? t(n.messageKey) : localizeNotificationText(n.message, lang)}
                      </p>
                      <div className="mt-1.5 flex items-center gap-3">
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
                          {TYPE_ICONS[n.type]}
                          {TYPE_LABELS[n.type] ?? n.type}
                        </span>
                        <span className="text-[10px] text-muted-foreground/70">
                          {timeAgo(n.timestamp)}
                        </span>
                        {n.action_url && (
                          <Link
                            href={n.action_url}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpen(false);
                              markRead(n.id);
                            }}
                            className="flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
                          >
                            {n.action_label_key ? t(n.action_label_key) : localizeNotificationText(n.action_label ?? t("notifications.viewAll"), lang)}
                            <ExternalLink className="h-2.5 w-2.5" />
                          </Link>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        dismiss(n.id);
                      }}
                      className="shrink-0 text-muted-foreground/0 transition-opacity group-hover:text-muted-foreground/60 hover:!text-muted-foreground"
                      aria-label={t("notifications.dismiss")}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
