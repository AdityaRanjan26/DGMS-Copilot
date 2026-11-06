import io
import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas

class NumberedCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_page_decorations(num_pages)
            super().showPage()
        super().save()

    def draw_page_decorations(self, page_count):
        self.saveState()
        # Top banner header
        self.setFillColor(colors.HexColor("#1b5e20")) # Forest green
        self.rect(0, 810, 595, 32, fill=True, stroke=False)
        self.setFillColor(colors.white)
        self.setFont("Helvetica-Bold", 10)
        self.drawString(36, 822, "CENTRAL COALFIELDS LIMITED — DGMS COMPLIANCE AUDIT REPORT")
        self.drawRightString(559, 822, datetime.datetime.now().strftime("%Y-%m-%d"))

        # Footer
        self.setStrokeColor(colors.HexColor("#e2e8f0"))
        self.setLineWidth(0.75)
        self.line(36, 45, 559, 45)

        self.setFillColor(colors.HexColor("#64748b"))
        self.setFont("Helvetica", 8)
        self.drawString(36, 30, "CONFIDENTIAL — FOR INTERNAL DGMS COMPLIANCE REVIEW ONLY")
        self.drawRightString(559, 30, f"Page {self._pageNumber} of {page_count}")
        self.restoreState()


def generate_compliance_pdf(analysis_data: dict) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=54,
        bottomMargin=54
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=6
    )

    section_style = ParagraphStyle(
        "SectionHeader",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=13,
        leading=16,
        textColor=colors.HexColor("#1b5e20"),
        spaceBefore=12,
        spaceAfter=6
    )

    body_style = ParagraphStyle(
        "BodyTextCustom",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#334155")
    )

    meta_label_style = ParagraphStyle(
        "MetaLabel",
        parent=body_style,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#475569")
    )

    story = []

    # Title & Subtitle
    story.append(Paragraph("Operational Compliance Review Report", title_style))
    story.append(Paragraph("Automated analysis & DGMS circular clause traceability summary", body_style))
    story.append(Spacer(1, 10))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#cbd5e1"), spaceAfter=12))

    # Key Metadata Table
    status = analysis_data.get("compliance_status", "Review Required")
    risk_level = analysis_data.get("overall_risk_level", "Medium")

    meta_data = [
        [
            Paragraph("Compliance Status:", meta_label_style),
            Paragraph(f"<b>{status}</b>", body_style),
            Paragraph("Overall Risk Level:", meta_label_style),
            Paragraph(f"<b>{risk_level}</b>", body_style)
        ],
        [
            Paragraph("Audit Scope:", meta_label_style),
            Paragraph("Pilot Operating Areas (Karo OCP & Amlo)", body_style),
            Paragraph("Target Regulations:", meta_label_style),
            Paragraph("CMR 2017 & DGMS Circulars", body_style)
        ]
    ]

    meta_table = Table(meta_data, colWidths=[110, 150, 110, 153])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#e2e8f0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ('PADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # Executive Summary
    story.append(Paragraph("Executive Summary", section_style))
    exec_summary = analysis_data.get("executive_summary", "No executive summary provided.")
    story.append(Paragraph(exec_summary, body_style))
    story.append(Spacer(1, 14))

    # Findings Table
    story.append(Paragraph("Detected Observations & Mandatory Actions", section_style))
    issues = analysis_data.get("detected_issues", [])

    if not issues:
        story.append(Paragraph("No critical compliance observations detected in this operational report.", body_style))
    else:
        table_data = [
            [
                Paragraph("<b>#</b>", meta_label_style),
                Paragraph("<b>Observation & Regulation</b>", meta_label_style),
                Paragraph("<b>Risk & Action Required</b>", meta_label_style),
                Paragraph("<b>DGMS Citation</b>", meta_label_style)
            ]
        ]

        for idx, issue in enumerate(issues, start=1):
            obs = f"<b>{issue.get('issue', '')}</b><br/><font color='#64748b'>Reg: {issue.get('applicable_regulation', 'N/A')}</font>"
            risk_val = issue.get('risk_level', 'Medium')
            action = f"<b>Risk: {risk_val}</b><br/>{issue.get('recommended_action', '')}"
            cit = f"<font fontName='Helvetica-Oblique'>{issue.get('citation', 'DGMS Reference')}</font>"

            table_data.append([
                Paragraph(str(idx), body_style),
                Paragraph(obs, body_style),
                Paragraph(action, body_style),
                Paragraph(cit, body_style)
            ])

        findings_table = Table(table_data, colWidths=[25, 175, 180, 143])
        findings_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
            ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#cbd5e1")),
            ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
            ('PADDING', (0, 0), (-1, -1), 6),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        story.append(findings_table)

    doc.build(story, canvasmaker=NumberedCanvas)
    return buffer.getvalue()
