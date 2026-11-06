"""
reports/doc_pdf_exporter.py

Enterprise PDF Generator for DGMS Repository Documents.
Transforms raw document text/metadata into beautifully styled, professional
PDFs supporting both English and Hindi (Devanagari / bilingual) modes with
native Unicode font registration (Mangal / Nirmala UI).
"""

import os
import io
import datetime
import re
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Font Registration for Devanagari (Hindi) Support ─────────────────────────

FONT_NORMAL = "Helvetica"
FONT_BOLD = "Helvetica-Bold"

def setup_unicode_fonts():
    global FONT_NORMAL, FONT_BOLD
    font_candidates = [
        ("Mangal", "C:/Windows/Fonts/mangal.ttf", "C:/Windows/Fonts/mangalb.ttf"),
        ("Nirmala", "C:/Windows/Fonts/nirmala.ttf", "C:/Windows/Fonts/nirmalab.ttf"),
        ("SegoeUI", "C:/Windows/Fonts/segoeui.ttf", "C:/Windows/Fonts/segoeuib.ttf"),
    ]
    for name, reg_path, bold_path in font_candidates:
        if os.path.exists(reg_path):
            try:
                b_path = bold_path if os.path.exists(bold_path) else reg_path
                pdfmetrics.registerFont(TTFont(name, reg_path))
                pdfmetrics.registerFont(TTFont(f"{name}-Bold", b_path))
                FONT_NORMAL = name
                FONT_BOLD = f"{name}-Bold"
                break
            except Exception:
                continue

setup_unicode_fonts()


class ProfessionalDocCanvas(canvas.Canvas):
    def __init__(self, *args, **kwargs):
        self.doc_title = kwargs.pop("doc_title", "DGMS OFFICIAL COMPLIANCE DOCUMENT")
        self.lang = kwargs.pop("lang", "en")
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
        self.setFillColor(colors.HexColor("#1b5e20"))  # DGMS Emerald Green
        self.rect(0, 808, 595, 34, fill=True, stroke=False)
        self.setFillColor(colors.white)
        self.setFont(FONT_BOLD, 8.5)

        if self.lang == "hi":
            header_left = "भारत सरकार / GOVT OF INDIA — DGMS अनुपालन रिपॉजिटरी"
            page_str = f"पृष्ठ {self._pageNumber} / {page_count}"
            footer_left = "आधिकारिक सुरक्षा परिपत्र एवं एसओपी संग्रह — सेन्ट्रल कोलफील्ड्स लिमिटेड"
        else:
            header_left = "BHARAT SARKAR / GOVT OF INDIA — DGMS COMPLIANCE REPOSITORY"
            page_str = f"Page {self._pageNumber} of {page_count}"
            footer_left = "OFFICIAL SAFETY CIRCULAR & SOP CORPUS — CENTRAL COALFIELDS LIMITED"

        header_right = datetime.datetime.now().strftime("%d %b %Y")
        self.drawString(36, 820, header_left)
        self.drawRightString(559, 820, header_right)

        # Footer line
        self.setStrokeColor(colors.HexColor("#cbd5e1"))
        self.setLineWidth(0.75)
        self.line(36, 45, 559, 45)

        # Footer text
        self.setFillColor(colors.HexColor("#64748b"))
        self.setFont(FONT_NORMAL, 8)
        self.drawString(36, 30, footer_left)
        self.drawRightString(559, 30, page_str)
        self.restoreState()


HINDI_TITLES = {
    "Inspection Frequency for Conveyor Belt Installations in Mechanised Mines":
        "यांत्रीकृत खानों में कन्वेयर बेल्ट प्रतिष्ठानों के लिए निरीक्षण आवृत्ति नियमन",
    "Ventilation Quantity Verification and Auxiliary Fan Log Procedure":
        "वेंटिलेशन मात्रा सत्यापन और सहायक पंखा लॉग प्रक्रिया निर्देश",
    "PPE Compliance During Blasting, Drilling, Haul Road Maintenance and High-Risk Activities in Mechanised Mines":
        "यांत्रीकृत खानों में विस्फोट, ड्रिलिंग और उच्च जोखिम गतिविधियों के दौरान पीपीई अनुपालन निर्देश",
    "Coal Mines Regulations 2017 — Part II: Management and Supervision":
        "कोयला खान नियमन 2017 — भाग II: प्रबंधन और पर्यवेक्षण वैधानिक प्रावधान",
    "PPE Compliance Audit Report — Q1 2025 (Karo OCP and Amlo Project)":
        "पीपीई अनुपालन ऑडिट रिपोर्ट — Q1 2025 (करो ओसीपी और आम्लो परियोजना)",
    "Operational Shift Report Corpus — June 2026 (Pilot Areas)":
        "परिचालन शिफ्ट रिपोर्ट संग्रह — जून 2026 (पायलट क्षेत्र)",
    "Critical Incident Report - Karo OCP": "गंभीर घटना रिपोर्ट — करो ओसीपी",
    "Incomplete Shift Report - Karo OCP": "अधूरी शिफ्ट रिपोर्ट — करो ओसीपी",
    "Safe Shift Report - Karo OCP": "सुरक्षित शिफ्ट रिपोर्ट — करो ओसीपी",
}

LINE_REPLACEMENTS_HI = [
    # Report Types & Headers
    ("Shift Report - Karo OCP", "शिफ्ट रिपोर्ट — करो ओसीपी"),
    ("Shift Report", "शिफ्ट रिपोर्ट"),
    ("Date:", "दिनांक:"),
    ("Shift:", "शिफ्ट:"),
    ("Personnel:", "कार्यरत कर्मचारी / अधिकारी:"),
    ("Shift Overman:", "शिफ्ट ओवरमैन:"),
    ("Safety Observations:", "सुरक्षा अवलोकन एवं रिपोर्ट:"),
    ("Corrective Actions:", "सुधारात्मक अनुपालन कार्रवाई:"),
    ("Incident Report", "घटना विवरण रिपोर्ट"),
    ("Critical Incident Report", "गंभीर घटना रिपोर्ट"),
    ("Incomplete Shift Report", "अधूरी शिफ्ट रिपोर्ट"),
    ("Safe Shift Report", "सुरक्षित शिफ्ट रिपोर्ट"),
    
    # Sentences in Reports & Documents
    ("Major roof fall observed in Panel 4C, 3 workers narrowly escaped.", "पैनल 4C में प्रमुख छत का गिरना देखा गया, 3 श्रमिक बाल-बाल बचे।"),
    ("Methane sensors are currently non-functional in the main heading.", "मुख्य हेडिंग में मीथेन गैस सेंसर वर्तमान में निष्क्रिय हैं।"),
    ("Ventilation auxiliary fan F-04 tripped and could not be restarted, leading to air stagnation.", "वेंटिलेशन सहायक पंखा F-04 ट्रिप हो गया और इसे पुनः चालू नहीं किया जा सका, जिससे वायु संचार अवरुद्ध हो गया।"),
    ("Explosives were found unattended near the drilling site without a shotfirer present.", "ड्रिलिंग स्थल के समीप बिना शॉटफायरर की उपस्थिति के लावारिस विस्फोटक सामग्री पाई गई।"),
    ("Immediate evacuation ordered.", "तत्काल अनुभाग खाली कराने का आदेश दिया गया।"),
    ("Evacuated the section.", "संबंधित क्षेत्र को तुरंत खाली कराया गया।"),
    ("Waiting for safety team to arrive.", "सुरक्षा जांच दल के आगमन की प्रतीक्षा की जा रही है।"),
    ("No major incidents reported.", "कोई बड़ी सुरक्षा घटना दर्ज नहीं की गई।"),
    ("All safety protocols followed.", "सभी मानक सुरक्षा प्रोटोकॉल का अनुपालन किया गया।"),

    # Sections & Statutory headings
    ("SECTION 1: PURPOSE AND APPLICABILITY", "धारा 1: उद्देश्य और प्रयोज्यता"),
    ("SECTION 2: CONVEYOR BELT INSPECTION FREQUENCY", "धारा 2: कन्वेयर बेल्ट निरीक्षण आवृत्ति"),
    ("SECTION 3: ROLLER & IDLER MAINTENANCE MANDATES", "धारा 3: रोलर और आइडलर रखरखाव जनादेश"),
    ("SECTION 4: PRE-SHIFT SAFETY CHECKS & LOGBOOK REQUIREMENTS", "धारा 4: प्री-शिफ्ट सुरक्षा जांच और लॉगबुक आवश्यकताएं"),
    ("SECTION 5: ENFORCEMENT AND PENALTIES FOR NON-COMPLIANCE", "धारा 5: गैर-अनुपालन के लिए प्रवर्तन और दंड"),
    ("SECTION 1: MANDATORY AIR QUANTITY MEASUREMENTS", "धारा 1: अनिवार्य वायु मात्रा माप"),
    ("SECTION 2: AUXILIARY FAN OPERATION & DUCT MAINTENANCE", "धारा 2: सहायक पंखा संचालन और डक्ट रखरखाव"),
    ("SECTION 3: GAS MONITORING AND EMERGENCY EVACUATION PROTOCOL", "धारा 3: गैस निगरानी और आपातकालीन निकासी प्रोटोकॉल"),
    ("SECTION 4: LOGBOOK RECORDING AND SIGN-OFF RESPONSIBILITIES", "धारा 4: लॉगबुक रिकॉर्डिंग और हस्ताक्षर जिम्मेदारियां"),
    ("SECTION 1: MANDATORY PPE REQUIREMENTS BY WORKING ZONE", "धारा 1: कार्य क्षेत्र द्वारा अनिवार्य पीपीई आवश्यकताएं"),
    ("SECTION 2: PPE INSPECTION & REPLACEMENT SCHEDULE", "धारा 2: पीपीई निरीक्षण और प्रतिस्थापन अनुसूची"),
    ("SECTION 3: COMPLIANCE MONITORING AND DISCIPLINARY ACTIONS", "धारा 3: अनुपालन निगरानी और अनुशासनात्मक कार्रवाइयां"),
    ("REGULATION 105: APPOINTMENT OF OVERMEN", "विनियमन 105: ओवरमैन की नियुक्ति"),
    ("REGULATION 106: DUTIES OF OVERMAN", "विनियमन 106: ओवरमैन के कर्तव्य"),
    ("REGULATION 107: APPOINTMENT OF MINING MATES", "विनियमन 107: माइनिंग मेट की नियुक्ति"),
    ("REGULATION 108: DUTIES OF MINING MATE", "विनियमन 108: माइनिंग मेट के कर्तव्य"),
    ("Pre-Shift Inspection and Operation Procedure", "प्री-शिफ्ट निरीक्षण और संचालन प्रक्रिया"),
    ("Conveyor Belt Safety", "कन्वेयर बेल्ट सुरक्षा"),
    ("Ventilation Procedure", "वेंटिलेशन प्रक्रिया"),
    ("PPE Compliance Audit", "पीपीई अनुपालन ऑडिट"),
    ("Operational Shift Report", "परिचालन शिफ्ट रिपोर्ट"),
    ("Critical Incident Report", "गंभीर घटना रिपोर्ट"),
    
    # Authorities & Locations
    ("Directorate General of Mines Safety", "खान सुरक्षा महानिदेशालय (DGMS)"),
    ("Central Coalfields Limited", "सेन्ट्रल कोलफील्ड्स लिमिटेड (CCL)"),
    ("Coal Mines Regulations, 2017", "कोयला खान नियमन, 2017"),
    ("The Mines Act, 1952", "खान अधिनियम, 1952"),
    ("Step 1:", "कदम 1:"),
    ("Step 2:", "कदम 2:"),
    ("Step 3:", "कदम 3:"),
    ("Step 4:", "कदम 4:"),
    ("Step 5:", "कदम 5:"),
    ("WARNING:", "चेतावनी:"),
    ("NOTE:", "नोट:"),
    ("IMPORTANT:", "महत्वपूर्ण:"),
    ("Karo OCP", "करो ओसीपी"),
    ("Amlo Project", "आम्लो परियोजना"),
    ("Piparwar OCP", "पिपरवार ओसीपी"),
    ("Dhori Area", "धोरी क्षेत्र"),
    ("Bokaro Colliery", "बोकारो कोलियरी"),
]

def translate_line(line: str, lang: str) -> str:
    if lang != "hi":
        return line
    res = line
    for en_pat, hi_pat in LINE_REPLACEMENTS_HI:
        res = res.replace(en_pat, hi_pat)
    return res


import html

def safe_paragraph(text: str, style: ParagraphStyle) -> Paragraph:
    try:
        return Paragraph(text, style)
    except Exception:
        clean = html.escape(text).replace("&amp;", "&amp;")
        return Paragraph(clean, style)

def build_professional_pdf(source_id: str, raw_text: str, doc_title: str, category: str, lang: str = "en") -> bytes:
    buffer = io.BytesIO()

    def canvas_maker(*args, **kwargs):
        kwargs["doc_title"] = doc_title
        kwargs["lang"] = lang
        return ProfessionalDocCanvas(*args, **kwargs)

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
        fontName=FONT_BOLD,
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4
    )

    sub_title_style = ParagraphStyle(
        "SubTitle",
        parent=styles["Normal"],
        fontName=FONT_BOLD,
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#1b5e20"),
        spaceAfter=10
    )

    h2_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName=FONT_BOLD,
        fontSize=11.5,
        leading=15,
        textColor=colors.HexColor("#065f46"),
        spaceBefore=12,
        spaceAfter=5
    )

    body_style = ParagraphStyle(
        "BodyCustom",
        parent=styles["Normal"],
        fontName=FONT_NORMAL,
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#1e293b"),
        spaceAfter=6
    )

    bullet_style = ParagraphStyle(
        "BulletCustom",
        parent=body_style,
        leftIndent=16,
        spaceAfter=4
    )

    warning_box_style = ParagraphStyle(
        "WarningBox",
        parent=styles["Normal"],
        fontName=FONT_NORMAL,
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#7f1d1d"),
        spaceAfter=8
    )

    meta_key_style = ParagraphStyle(
        "MetaKey",
        fontName=FONT_BOLD,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#475569")
    )
    meta_val_style = ParagraphStyle(
        "MetaVal",
        fontName=FONT_NORMAL,
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#0f172a")
    )

    story = []
    story.append(Spacer(1, 10))

    # Title formatting
    if lang == "hi":
        hi_title = HINDI_TITLES.get(doc_title, doc_title)
        display_title = f"{html.escape(hi_title)}<br/><font color='#64748b' size=10>[{html.escape(doc_title)}]</font>"
    else:
        display_title = html.escape(doc_title)

    story.append(safe_paragraph(display_title, title_style))
    ref_label = "दस्तावेज़ संदर्भ:" if lang == "hi" else "DOCUMENT REF:"
    cat_label = "श्रेणी:" if lang == "hi" else "CATEGORY:"
    story.append(safe_paragraph(f"<b>{ref_label}</b> {html.escape(source_id)} | <b>{cat_label}</b> {html.escape(category.upper())}", sub_title_style))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#1b5e20"), spaceAfter=10))

    # Metadata Table
    if lang == "hi":
        meta_data = [
            [
                safe_paragraph("<b>जारीकर्ता प्राधिकरण:</b>", meta_key_style),
                safe_paragraph("खान सुरक्षा महानिदेशालय (DGMS) / CCL", meta_val_style),
                safe_paragraph("<b>वर्गीकरण:</b>", meta_key_style),
                safe_paragraph("नियंत्रित अनुपालन दस्तावेज़", meta_val_style),
            ],
            [
                safe_paragraph("<b>स्थिति:</b>", meta_key_style),
                safe_paragraph("<font color='#059669'><b>सक्रिय एवं अनुक्रमित</b></font>", meta_val_style),
                safe_paragraph("<b>भाषा मोड:</b>", meta_key_style),
                safe_paragraph("हिन्दी (Devanagari)", meta_val_style),
            ]
        ]
    else:
        meta_data = [
            [
                safe_paragraph("<b>Issuing Authority:</b>", meta_key_style),
                safe_paragraph("Directorate General of Mines Safety (DGMS) / CCL", meta_val_style),
                safe_paragraph("<b>Classification:</b>", meta_key_style),
                safe_paragraph("Controlled Compliance Document", meta_val_style),
            ],
            [
                safe_paragraph("<b>Status:</b>", meta_key_style),
                safe_paragraph("<font color='#059669'><b>Active &amp; Indexed</b></font>", meta_val_style),
                safe_paragraph("<b>Language Mode:</b>", meta_key_style),
                safe_paragraph("English (Official)", meta_val_style),
            ]
        ]

    meta_table = Table(meta_data, colWidths=[110, 160, 90, 163])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#f8fafc")),
        ('BOX', (0, 0), (-1, -1), 0.75, colors.HexColor("#e2e8f0")),
        ('INNERGRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#f1f5f9")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(meta_table)
    story.append(Spacer(1, 14))

    # Process Document Text
    cleaned_lines = raw_text.splitlines()

    for line in cleaned_lines:
        sline = line.strip()
        if not sline:
            story.append(Spacer(1, 4))
            continue

        # Clean broken ASCII symbols
        sline = re.sub(r'Step\s+(\d+)\s*\?', r'Step \1:', sline)
        sline = re.sub(r'^\?\s*', '• ', sline)
        sline = re.sub(r'\(\?\)', '', sline)
        sline = sline.replace(' ? ', ' — ')

        # Apply translation if in Hindi mode
        tline = translate_line(sline, lang)
        escaped_tline = html.escape(tline)

        # Check for Warning / Emergency Callout Box
        if any(keyword in tline.upper() for keyword in ["WARNING", "DANGER", "EMERGENCY", "VIOLATION", "चेतावनी", "खतरा"]):
            box_table = Table(
                [[safe_paragraph(f"<b>⚠️ {escaped_tline}</b>", warning_box_style)]],
                colWidths=[523]
            )
            box_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor("#fef2f2")),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor("#f87171")),
                ('LEFTPADDING', (0, 0), (-1, -1), 10),
                ('RIGHTPADDING', (0, 0), (-1, -1), 10),
                ('TOPPADDING', (0, 0), (-1, -1), 8),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ]))
            story.append(box_table)
            story.append(Spacer(1, 6))
        # Section Heading
        elif (sline.isupper() and len(sline) < 60) or sline.startswith("SECTION") or sline.startswith("REGULATION") or sline.startswith("Step ") or re.match(r'^\d+\.\d+\s+[A-Z]', sline) or tline.startswith("धारा") or tline.startswith("विनियमन") or tline.startswith("कदम"):
            story.append(safe_paragraph(escaped_tline, h2_style))
        # Bullet list item
        elif tline.startswith("• ") or tline.startswith("- ") or re.match(r'^\([a-z\d]+\)', tline):
            text_content = tline.lstrip("•- ").strip()
            story.append(safe_paragraph(f"• {html.escape(text_content)}", bullet_style))
        else:
            story.append(safe_paragraph(escaped_tline, body_style))

    # Build PDF
    doc.build(story, canvasmaker=canvas_maker)
    buffer.seek(0)
    return buffer.getvalue()
