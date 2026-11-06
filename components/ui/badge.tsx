import * as React from "react";
import { cn } from "@/lib/utils";

const tones = {
  green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  blue: "bg-sky-50 text-sky-800 border-sky-200",
  red: "bg-red-50 text-red-800 border-red-200",
  neutral: "bg-stone-100 text-stone-800 border-stone-200"
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center justify-center rounded-md border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}


