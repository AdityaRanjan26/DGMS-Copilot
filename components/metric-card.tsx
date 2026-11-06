import React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

export const MetricCard = React.memo(function MetricCard({
  label,
  value,
  delta,
  detail,
  tone
}: {
  label: string;
  value: string;
  delta: string;
  detail: string;
  tone: "green" | "amber" | "blue" | "red" | "neutral" | string;
}) {
  const safeTone = ["green", "amber", "blue", "red", "neutral"].includes(tone) ? tone : "neutral";

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-muted-foreground">{label}</p>
          <Badge tone={safeTone as "green" | "amber" | "blue" | "red" | "neutral"}>{delta}</Badge>
        </div>
        <p className="mt-4 text-3xl font-bold tracking-normal text-foreground">{value}</p>
        <p className="mt-2 text-sm text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
});


