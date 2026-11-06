"use client";

import { useState } from "react";
import { ClipboardList, Download, TriangleAlert, Upload, AlertCircle, FileSearch } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DonutScore } from "@/components/charts";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { localizeDocText } from "@/lib/i18n/localize";

type DetectedIssue = {
  issue: string;
  risk_level: string;
  why_assigned: string;
  applicable_regulation: string;
  recommended_action: string;
  citation: string;
};

type ComplianceData = {
  executive_summary: string;
  compliance_status: string;
  overall_risk_level: string;
  detected_issues: DetectedIssue[];
};

type ExtractedData = {
  equipment: string[];
  locations: string[];
  personnel: string[];
  dates: string[];
  safety_observations: string[];
  hazards: string[];
  corrective_actions: string[];
};

export default function ShiftAnalysisPage() {
  const { t, lang } = useLanguage();
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [reportData, setReportData] = useState<{
    filename: string;
    extracted_data: ExtractedData;
    compliance_data: ComplianceData;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);
    setReportData(null);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/reports/analyze", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setReportData(data);
      } else {
        setError(data.error || data.detail || "Analysis failed");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error analyzing report";
      setError(msg);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleExport() {
    if (!reportData) return;
    window.location.href = `/api/reports/export?filename=${encodeURIComponent(reportData.filename)}`;
  }

  let score = 100;
  let statusSummary = t("reports.statusNoIssues");
  if (reportData?.compliance_data.compliance_status.toLowerCase() === "amber") {
    score = 75;
    statusSummary = t("reports.statusReviewRequired");
  } else if (reportData?.compliance_data.compliance_status.toLowerCase() === "red") {
    score = 45;
    statusSummary = t("reports.statusCritical");
  }

  const allOperationalDetails = reportData 
    ? [...reportData.extracted_data.equipment, ...reportData.extracted_data.locations, ...reportData.extracted_data.personnel]
    : [];

  return (
    <>
      <PageHeader
        eyebrow={t("reports.title")}
        title={t("reports.subtitle")}
        description={t("reports.description")}
        action={
          <div className="flex items-center gap-2">
            <input 
              type="file" 
              id="report-upload" 
              className="hidden" 
              accept=".pdf,.docx,.txt"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="report-upload">
              <Button variant="secondary" asChild>
                <span>
                  <Upload className="h-4 w-4 mr-2" />
                  {file ? file.name : t("reports.selectReport")}
                </span>
              </Button>
            </label>
            <Button onClick={handleAnalyze} disabled={!file || isAnalyzing}>
              {isAnalyzing ? t("reports.analyzing") : t("reports.analyze")}
            </Button>
            {reportData && (
              <Button onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" />
                {t("reports.exportPdf")}
              </Button>
            )}
          </div>
        }
      />
      
      {error && (
        <div className="container py-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {reportData ? (
        <div className="container grid gap-6 py-6 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader>
              <CardTitle>{t("reports.reportAnalysis", { filename: reportData.filename })}</CardTitle>
              <CardDescription>{localizeDocText(reportData.compliance_data.executive_summary, lang)}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reportData.compliance_data.detected_issues.map((issue, idx) => (
                <div key={idx} className="rounded-md border bg-card p-5 transition-colors hover:bg-muted/35">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-3">
                      <TriangleAlert className="h-5 w-5 text-ccl-red" />
                      <p className="font-bold">{localizeDocText(issue.issue, lang)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge tone={issue.risk_level.toLowerCase() === "critical" || issue.risk_level.toLowerCase() === "high" ? "red" : "amber"}>
                        {lang === "hi" ? (issue.risk_level === "Critical" ? "गंभीर" : issue.risk_level === "High" ? "उच्च" : "मध्यम") : issue.risk_level}
                      </Badge>
                    </div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">
                    <strong>{t("reports.why")}</strong> {localizeDocText(issue.why_assigned, lang)}<br/>
                    <strong>{t("reports.regulation")}</strong> {localizeDocText(issue.applicable_regulation, lang)}<br/>
                    <strong>{t("reports.citation")}</strong> {localizeDocText(issue.citation, lang)}
                  </p>
                  <div className="mt-4 rounded-md bg-muted p-3">
                    <p className="text-xs font-bold uppercase text-muted-foreground">{t("reports.recommendedAction")}</p>
                    <p className="mt-1 text-sm font-semibold">{localizeDocText(issue.recommended_action, lang)}</p>
                  </div>
                </div>
              ))}
              {reportData.compliance_data.detected_issues.length === 0 && (
                <div className="p-4 text-center text-muted-foreground">{t("reports.noIssues")}</div>
              )}
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.complianceScore")}</CardTitle>
                <CardDescription>{t("reports.overallRisk", { level: reportData.compliance_data.overall_risk_level })}</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutScore value={score} label={t("reports.status", { status: reportData.compliance_data.compliance_status })} summary={statusSummary} />
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>{t("reports.operationalDetails")}</CardTitle>
                <CardDescription>{t("reports.extractedFrom")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {allOperationalDetails.map((detail, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-md border bg-card p-3 transition-colors hover:bg-muted/35">
                    <ClipboardList className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">{detail}</span>
                  </div>
                ))}
                {allOperationalDetails.length === 0 && (
                  <div className="rounded-md border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
                    {t("reports.noDetails")}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      ) : !error ? (
        <div className="container py-20">
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <FileSearch className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="mt-4 text-lg font-bold">{t("reports.noReport")}</p>
              <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                {t("reports.uploadInstruction")}
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </>
  );
}


