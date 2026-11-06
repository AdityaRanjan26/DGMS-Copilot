import Link from "next/link";
import { ArrowRight, Building2, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function LoginPage() {
  return (
    <main className="executive-grid min-h-screen">
      <div className="container grid min-h-screen items-center gap-8 py-8 lg:grid-cols-[1fr_440px]">
        <section className="max-w-3xl">
          <Badge tone="green">Central Coalfields Limited Compliance Platform</Badge>
          <div className="mt-6 flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-enterprise">
              <Building2 className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-4xl font-bold tracking-normal text-foreground md:text-5xl">
                DGMS-Copilot
              </h1>
              <p className="mt-2 text-lg text-muted-foreground">Mining compliance intelligence platform</p>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            A secure compliance operations platform for searching DGMS references, reviewing citation-backed
            recommendations, managing the knowledge repository, and analysing operational safety reports.
          </p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {["Requirements governed", "UX flow approved", "Platform available"].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-md border bg-card p-3 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {item}
              </div>
            ))}
          </div>
        </section>

        <Card>
          <CardContent className="p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Secure Login</h2>
                <p className="mt-1 text-sm text-muted-foreground">Authorized platform access</p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-md bg-secondary">
                <LockKeyhole className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="space-y-4">
              <label htmlFor="officer-id" className="block text-sm font-semibold">
                Officer ID
                <Input id="officer-id" className="mt-2" defaultValue="CCL-SAFE-1024" />
              </label>
              <label htmlFor="password" className="block text-sm font-semibold">
                Password
                <Input id="password" className="mt-2" type="password" defaultValue="platform" />
              </label>
              <Button asChild className="mt-2 w-full" size="lg">
                <Link href="/dashboard">
                  Enter DGMS-Copilot Platform
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-6 rounded-md border bg-muted/45 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                <p className="text-sm leading-6 text-muted-foreground">
                  Access is role-based and designed for compliance teams handling DGMS circulars, SOPs,
                  inspection checklists, and operational reporting workflows.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}


