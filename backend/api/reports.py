from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
import logging

from reports.report_ingestion import extract_text_from_file
from reports.report_analysis import analyze_report_content
from reports.risk_scoring import score_risks_and_compliance
from reports.report_export import generate_compliance_pdf

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx"}

# In-memory store for reports for export purposes (in a real app, use a DB)
_report_cache = {}

@router.post("/analyze")
async def analyze_report(file: UploadFile = File(...)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
        
    import os
    _, ext = os.path.splitext(file.filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type {ext} not allowed. Please upload .txt, .pdf, or .docx.")
    
    try:
        content = await file.read()
        
        # 1. Ingest
        text = extract_text_from_file(file.filename, content)
        
        # 2. Analyze
        extracted_data = analyze_report_content(text)
        
        # 3. Score Risks
        compliance_data = score_risks_and_compliance(extracted_data.get("hazards", []))
        
        # Combine results
        final_result = {
            "filename": file.filename,
            "extracted_data": extracted_data,
            "compliance_data": compliance_data
        }
        
        # Cache for export
        _report_cache[file.filename] = final_result
        
        return final_result
    except Exception as e:
        logger.exception("Error analyzing report")
        raise HTTPException(status_code=500, detail={"error": "Analysis failed", "message": str(e)})

@router.get("/export/{filename}")
async def export_report(filename: str):
    if filename not in _report_cache:
        raise HTTPException(status_code=404, detail="Report not found")
        
    try:
        report_data = _report_cache[filename]
        pdf_bytes = generate_compliance_pdf(report_data["compliance_data"])
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=compliance_{filename}.pdf"}
        )
    except Exception as e:
        logger.exception("Error exporting report")
        raise HTTPException(status_code=500, detail={"error": "Export failed", "message": str(e)})
