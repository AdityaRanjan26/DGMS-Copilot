import type { ComponentType } from "react";
import {
  AlertTriangle,
  BookOpenCheck,
  ClipboardCheck,
  Cpu,
  FileCheck2,
  HardHat,
  ShieldCheck,
  Siren,
  Wind
} from "lucide-react";

// Metric cards — labels and details are i18n keys resolved in the dashboard
export const complianceMetrics = [
  {
    labelKey: "dashboard.metric_compliance_label",
    value: "92.4%",
    delta: "+1.6%",
    tone: "green",
    detailKey: "dashboard.metric_compliance_detail"
  },
  {
    labelKey: "dashboard.metric_highrisk_label",
    value: "5",
    delta: "-2",
    tone: "amber",
    detailKey: "dashboard.metric_highrisk_detail"
  },
  {
    labelKey: "dashboard.metric_indexed_label",
    value: "18",
    delta: "+6",
    tone: "blue",
    detailKey: "dashboard.metric_indexed_detail"
  },
  {
    labelKey: "dashboard.metric_reports_label",
    value: "23",
    delta: "+7",
    tone: "green",
    detailKey: "dashboard.metric_reports_detail"
  }
];

export const mineHealth = [
  { mine: "Karo OCP", mineKey: "mines.karoOCP", compliance: 94, inspections: 9, pending: 2 },
  { mine: "Amlo Project", mineKey: "mines.amloProject", compliance: 89, inspections: 7, pending: 3 },
  { mine: "Dhori Area", mineKey: "mines.dhoriArea", compliance: 92, inspections: 5, pending: 1 },
  { mine: "Bokaro Colliery", mineKey: "mines.bokaroColliery", compliance: 86, inspections: 4, pending: 4 },
  { mine: "Rajrappa OCP", mineKey: "mines.rajrappaOCP", compliance: 95, inspections: 6, pending: 1 }
];

// riskTrend day labels are i18n keys
export const riskTrend = [
  { labelKey: "dashboard.day_mon", value: 7 },
  { labelKey: "dashboard.day_tue", value: 6 },
  { labelKey: "dashboard.day_wed", value: 8 },
  { labelKey: "dashboard.day_thu", value: 5 },
  { labelKey: "dashboard.day_fri", value: 5 },
  { labelKey: "dashboard.day_sat", value: 4 },
  { labelKey: "dashboard.day_sun", value: 5 }
];

export const searchResults = [
  {
    id: "DGMS-CIR-2024-17",
    title: "Inspection frequency for conveyor belt installations in mechanised mines",
    type: "DGMS Circular",
    score: "98%",
    excerpt:
      "Belt conveyor routes shall be inspected once per shift for guarding, pull-cord condition, fire load, spillage, and emergency stop availability.",
    mineContext: "Applicable to Karo OCP CHP and Amlo surface dispatch section",
    date: "12 Mar 2024",
    owner: "Safety Directorate"
  },
  {
    id: "CCL-SOP-VT-041",
    title: "Ventilation quantity verification and auxiliary fan log procedure",
    type: "Mine SOP",
    score: "94%",
    excerpt:
      "Ventilation measurement shall be recorded before start of shift and after any stoppage exceeding thirty minutes in active development districts.",
    mineContext: "Relevant for underground panels and fan attendant handover notes",
    date: "06 Jan 2025",
    owner: "Mine Manager Office"
  },
  {
    id: "DGMS-TECH-NOTE-2023-09",
    title: "PPE compliance during blasting, drilling, and haul road maintenance",
    type: "Technical Note",
    score: "91%",
    excerpt:
      "Supervisors shall ensure hard hats, reflective jackets, safety shoes, eye protection, and dust masks are verified before hazardous task allocation.",
    mineContext: "Mapped to pre-shift attendance and supervisor declaration",
    date: "18 Sep 2023",
    owner: "Occupational Safety Cell"
  }
];

export const documents = [
  {
    name: "DGMS Conveyor Safety Circular 2024-17",
    category: "DGMS Circular",
    status: "Indexed",
    clauses: 18,
    confidence: 98,
    updated: "16 Jun 2026"
  },
  {
    name: "CCL Mine Safety SOP - Belt Conveyor Operation",
    category: "Internal SOP",
    status: "Under Review",
    clauses: 42,
    confidence: 87,
    updated: "17 Jun 2026"
  },
  {
    name: "Ventilation Register Extract",
    category: "Operational Register",
    status: "Indexed",
    clauses: 13,
    confidence: 93,
    updated: "18 Jun 2026"
  },
  {
    name: "PPE Audit Checklist",
    category: "Inspection Checklist",
    status: "Review Needed",
    clauses: 24,
    confidence: 81,
    updated: "19 Jun 2026"
  },
  {
    name: "Shift Report Corpus - June Operations",
    category: "Shift Reports",
    status: "Indexed",
    clauses: 31,
    confidence: 90,
    updated: "20 Jun 2026"
  }
];

export const citations = [
  {
    ref: "DGMS-CIR-2024-17 / Clause 4.2",
    title: "Belt conveyor shift inspection",
    quote:
      "Inspect guarding, pull-cord switches, belt alignment, spillage accumulation, and fire extinguishing readiness once in every production shift.",
    answerUse:
      "Supports assistant recommendation that conveyor inspection should occur every shift, with defect logging and supervisor closure."
  },
  {
    ref: "CCL-SOP-VT-041 / Section 3.1",
    title: "Ventilation reading before deployment",
    quote:
      "No deployment shall be made in a working district unless latest air quantity and fan status are recorded in the shift register.",
    answerUse:
      "Used to flag missing pre-shift ventilation records in the B-shift report."
  },
  {
    ref: "PPE-AUDIT-OPS-25 / Checklist Item 7",
    title: "Reflective jacket and helmet compliance",
    quote:
      "Persons entering haul road, stockyard, CHP, and workshop zones must be observed with helmet, reflective jacket, and safety footwear.",
    answerUse:
      "Used to score PPE compliance and identify two repeated exceptions near the CHP transfer point."
  }
];

export const chatMessages = [
  {
    role: "user",
    content: "What is the expected inspection frequency for conveyor belt safety checks?"
  },
  {
    role: "assistant",
    content:
      "For the current document corpus, belt conveyor safety checks are treated as once per production shift. The assistant checks guarding, pull-cords, emergency stops, spillage, alignment, illumination, and fire extinguishers, then cites DGMS-CIR-2024-17 Clause 4.2 and the CCL belt conveyor SOP."
  },
  {
    role: "user",
    content: "Flag any issue from last night's B shift report."
  },
  {
    role: "assistant",
    content:
      "Two items need supervisor review: ventilation reading was recorded 52 minutes after deployment in Panel 3A, and PPE exceptions were noted for two contract workers near CHP Transfer Point 2. Recommended closure: update the ventilation register, capture toolbox-talk acknowledgement, and verify PPE issuance before next shift."
  }
];

export const shiftFindings = [
  {
    title: "Ventilation Register Delay",
    severity: "High",
    area: "Panel 3A",
    finding:
      "Air quantity entry was captured after worker deployment, creating a procedural gap against CCL-SOP-VT-041.",
    action: "Shift engineer to verify readings before start of next B shift."
  },
  {
    title: "Conveyor Spillage Repeat Observation",
    severity: "Medium",
    area: "CHP Transfer Point 2",
    finding:
      "Spillage noted for second consecutive shift with partial housekeeping closure.",
    action: "Assign belt attendant and close with timestamped photo evidence."
  },
  {
    title: "PPE Compliance Exception",
    severity: "Medium",
    area: "Haul Road Junction",
    finding:
      "Two workers observed without dust masks during dry haul road maintenance.",
    action: "Issue replacement masks and record toolbox-talk acknowledgement."
  }
];

// Admin rows — labels are i18n keys, domain is also an i18n key
export const adminRows = [
  { labelKey: "admin.tracker_row1_label", statusKey: "admin.statusMapped", ownerKey: "admin.tracker_row1_owner" },
  { labelKey: "admin.tracker_row2_label", statusKey: "admin.statusOperational", ownerKey: "admin.tracker_row2_owner" },
  { labelKey: "admin.tracker_row3_label", statusKey: "admin.statusOperational", ownerKey: "admin.tracker_row3_owner" },
  { labelKey: "admin.tracker_row4_label", statusKey: "admin.statusScheduled", ownerKey: "admin.tracker_row4_owner" }
];

export const architectureStages = [
  {
    title: "Documents",
    description: "DGMS circulars, CCL SOPs, inspection checklists, and operational reports."
  },
  {
    title: "OCR Pipeline",
    description: "Document capture, layout extraction, table handling, and quality checks."
  },
  {
    title: "Clause Segmentation",
    description: "Safety clauses are split, normalized, tagged, and linked to source metadata."
  },
  {
    title: "Vector Database",
    description: "Embeddings support semantic retrieval while preserving citation references."
  },
  {
    title: "Retrieval Layer",
    description: "Policy filters, confidence ranking, and traceability checks prepare answer context."
  },
  {
    title: "DGMS-Copilot Assistant",
    description: "Users receive grounded answers, risk flags, and closure recommendations."
  }
];

export interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

export const navigation: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: ShieldCheck },
  { href: "/search", label: "DGMS Search", icon: BookOpenCheck },
  { href: "/assistant", label: "Assistant", icon: HardHat },
  { href: "/repository", label: "Knowledge Repository", icon: FileCheck2 },
  { href: "/citations", label: "Traceability", icon: ClipboardCheck },
  { href: "/shift-analysis", label: "Operational Reports", icon: Wind },
  { href: "/architecture", label: "System Architecture", icon: Cpu, adminOnly: true },
  { href: "/admin", label: "Governance", icon: Siren }
];

// Alerts — use i18n keys
export const alerts = [
  {
    icon: AlertTriangle,
    titleKey: "dashboard.alert1_title",
    textKey: "dashboard.alert1_text",
    tone: "red"
  },
  {
    icon: ClipboardCheck,
    titleKey: "dashboard.alert2_title",
    textKey: "dashboard.alert2_text",
    tone: "green"
  },
  {
    icon: FileCheck2,
    titleKey: "dashboard.alert3_title",
    textKey: "dashboard.alert3_text",
    tone: "blue"
  }
];
