import type React from "react";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="border-b bg-card">
      <div className="container flex flex-col gap-4 py-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <Badge tone="green">{eyebrow}</Badge>
          <h1 className="mt-3 text-2xl font-bold tracking-normal text-foreground md:text-3xl">{title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}


