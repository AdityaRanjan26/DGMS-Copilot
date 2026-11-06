"use client";

import type React from "react";
import { Activity, Download, FileSearch, ShieldAlert, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricCard } from "@/components/metric-card";
import { ComplianceBars, DonutScore, RiskTrend } from "@/components/charts";
import { alerts, complianceMetrics, mineHealth, riskTrend } from "@/lib/platform-data";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import Link from "next/link";

export default function DashboardPage() {
  const { t } = useLanguage();

  return (
    <>
      <PageHeader
        eyebrow={t("dashboard.headerEyebrow")}
        title={t("dashboard.headerTitle")}
        description={t("dashboard.headerDesc")}
        action={
          <Button>
            <Download className="mr-2 h-4 w-4" />
            {t("dashboard.export")}
          </Button>
        }
      />
      <div className="container space-y-6 py-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {complianceMetrics.map((metric, i) => (
            <Link key={metric.labelKey} href={i === 2 ? "/repository" : i === 3 ? "/shift-analysis" : "/citations"} className="block transition-transform hover:-translate-y-0.5">
              <MetricCard
                label={t(metric.labelKey)}
                value={metric.value}
                delta={metric.delta}
                tone={metric.tone}
                detail={t(metric.detailKey)}
              />
            </Link>
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] md:grid-cols-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>{t("dashboard.mineHealthTitle")}</CardTitle>
                <CardDescription>{t("dashboard.mineHealthDesc")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <ComplianceBars 
                data={mineHealth.map(m => ({ ...m, mine: t(m.mineKey) }))} 
                inspectionsLabel={t("dashboard.inspections")} 
                pendingLabel={t("dashboard.pendingActions")} 
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.riskTrendTitle")}</CardTitle>
              <CardDescription>{t("dashboard.riskTrendDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <RiskTrend data={riskTrend.map(d => ({ label: t(d.labelKey), value: d.value }))} />
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] md:grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>{t("dashboard.systemHealthTitle")}</CardTitle>
              <CardDescription>{t("dashboard.systemHealthDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <DonutScore value={96} label={t("dashboard.systemHealthOperational") || "Operational availability"} summary={t("dashboard.systemHealthStatus") || "Operational status normal"} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>{t("dashboard.alertsTitle")}</CardTitle>
                <CardDescription>{t("dashboard.alertsDesc")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/shift-analysis" className="text-xs">
                  {t("common.viewAll") || "View All"}
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts.map((alert, i) => {
                const Icon = alert.icon;
                const linkDest = i === 2 ? "/repository" : "/shift-analysis";
                return (
                  <Link key={alert.titleKey} href={linkDest} className="group flex items-start gap-3 rounded-md border bg-card p-3 transition-all hover:bg-muted/50 hover:shadow-sm">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted group-hover:bg-background transition-colors">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm group-hover:text-primary transition-colors">{t(alert.titleKey)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{t(alert.textKey)}</p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                  </Link>
                );
              })}
            </CardContent>
          </Card>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(
            [
              { key: "architecture", icon: Activity, href: "/architecture" },
              { key: "search", icon: FileSearch, href: "/search" },
              { key: "controls", icon: ShieldAlert, href: "/admin" }
            ] as { key: string; icon: React.ElementType, href: string }[]
          ).map(({ key, icon: Icon, href }) => (
            <Link key={key} href={href} className="block transition-transform hover:-translate-y-0.5">
              <Card className="h-full hover:border-primary/50 transition-colors">
                <CardContent className="p-5 flex flex-col h-full justify-between">
                  <div>
                    <Icon className="h-5 w-5 text-primary mb-3" />
                    <p className="font-bold text-foreground group-hover:text-primary">{t(`nav.${key === 'controls' ? 'governance' : key === 'search' ? 'dgms search' : 'system architecture'}`)}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{t(`dashboard.card_${key}_text`) || "Quick access to platform functionality."}</p>
                  </div>
                  <div className="mt-4 flex items-center text-xs font-medium text-primary">
                    {t("dashboard.viewDetails") || "View Details"} <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
