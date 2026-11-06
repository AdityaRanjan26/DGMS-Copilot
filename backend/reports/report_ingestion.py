import io
import docx
from pypdf import PdfReader

def extract_text_from_file(filename: str, file_bytes: bytes) -> str:
    """Extracts text from PDF, DOCX, or TXT."""
    ext = filename.split(".")[-1].lower()
    
    if ext == "pdf":
        reader = PdfReader(io.BytesIO(file_bytes))
        text = "\n".join(page.extract_text() for page in reader.pages if page.extract_text())
        return text
    elif ext in ("docx", "doc"):
        doc = docx.Document(io.BytesIO(file_bytes))
        text = "\n".join(paragraph.text for paragraph in doc.paragraphs)
        return text
    elif ext == "txt":
        return file_bytes.decode("utf-8", errors="replace")
    else:
        raise ValueError(f"Unsupported file format: {ext}")
