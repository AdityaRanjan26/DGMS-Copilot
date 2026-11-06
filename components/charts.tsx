"use client";

import React from "react";
import { motion } from "framer-motion";

export const ComplianceBars = React.memo(function ComplianceBars({
  data,
  inspectionsLabel = "inspections",
  pendingLabel = "pending actions"
}: {
  data: { mine: string; compliance: number; inspections: number; pending: number }[];
  inspectionsLabel?: string;
  pendingLabel?: string;
}) {
  return (
    <div className="space-y-4">
      {data.map((item, index) => (
        <div key={item.mine} className="rounded-md p-2 transition-colors hover:bg-muted/45">
          <div className="mb-1 flex items-center justify-between text-sm">
            <span className="font-semibold">{item.mine}</span>
            <span className="text-muted-foreground">{item.compliance}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-sm bg-muted">
            <motion.div
              className="h-full rounded-sm bg-primary"
              initial={{ width: 0 }}
              animate={{ width: `${item.compliance}%` }}
              transition={{ delay: index * 0.06, duration: 0.55, ease: "easeOut" }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.inspections} {inspectionsLabel}, {item.pending} {pendingLabel}
          </p>
        </div>
      ))}
    </div>
  );
});

export const RiskTrend = React.memo(function RiskTrend({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(...data.map((d) => d.value));
  const points = data
    .map((d, i) => {
      const x = 20 + i * 56;
      const y = 132 - (d.value / max) * 92;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox="0 0 380 160" className="h-48 w-full" role="img" aria-label="Weekly risk trend">
        <defs>
          <linearGradient id="riskFill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#a1322b" stopOpacity="0.24" />
            <stop offset="100%" stopColor="#a1322b" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <polyline points={`20,140 ${points} 356,140`} fill="url(#riskFill)" stroke="none" />
        <motion.polyline
          points={points}
          fill="none"
          stroke="#a1322b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
        {data.map((d, i) => {
          const x = 20 + i * 56;
          const y = 132 - (d.value / max) * 92;
          return (
            <g key={i}>
              <circle cx={x} cy={y} r="4" fill="#a1322b" />
              <text x={x} y="154" textAnchor="middle" className="fill-stone-500 text-[10px]">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
});

export const DonutScore = React.memo(function DonutScore({
  value,
  label,
  summary = "Operational status within configured thresholds"
}: {
  value: number;
  label: string;
  summary?: string;
}) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="flex items-center gap-4">
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={radius} fill="none" stroke="#e6e1d6" strokeWidth="12" />
        <motion.circle
          cx="56"
          cy="56"
          r={radius}
          fill="none"
          stroke="#17633a"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          transform="rotate(-90 56 56)"
        />
        <text x="56" y="61" textAnchor="middle" className="fill-coal-900 text-xl font-bold">
          {value}%
        </text>
      </svg>
      <div>
        <p className="text-sm font-semibold text-muted-foreground">{label}</p>
        <p className="mt-1 text-lg font-bold">{summary}</p>
      </div>
    </div>
  );
});


