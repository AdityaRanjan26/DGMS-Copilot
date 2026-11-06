"""
ingestion/loader.py

Loads all documents from the documents directory, extracts metadata,
and returns a list of (DocumentMetadata, body_text) tuples ready for
chunking.

Supported formats:
  - .txt  — plain text (used for all current corpus documents)
  - .pdf  — PDF files via pypdf (no OCR — text layer only)

The loader is intentionally generic. To replace synthetic documents
with real CCL documents, simply drop the new file in the appropriate
subdirectory under documents/ with the correct header block.
No code changes are required.
"""

from __future__ import annotations
from pathlib import Path
from typing import Generator
import logging

from ingestion.metadata import DocumentMetadata, parse_metadata

logger = logging.getLogger(__name__)

# Supported file extensions
SUPPORTED_EXTENSIONS = {".txt", ".pdf"}


def _load_txt(file_path: Path) -> str:
    """Load a plain text file."""
    return file_path.read_text(encoding="utf-8", errors="replace")


def _load_pdf(file_path: Path) -> str:
    """
    Load a PDF file using pypdf. Extracts text layer only (no OCR).
    Returns concatenated text from all pages.
    """
    try:
        import pypdf  # type: ignore
    except ImportError:
        raise ImportError("pypdf is required to load PDF files. Run: pip install pypdf")

    text_parts: list[str] = []
    reader = pypdf.PdfReader(str(file_path))
    for page in reader.pages:
        page_text = page.extract_text() or ""
        text_parts.append(page_text)
    return "\n".join(text_parts)


def load_document(file_path: Path) -> tuple[DocumentMetadata, str] | None:
    """
    Load a single document file. Returns (metadata, body) or None on error.
    """
    suffix = file_path.suffix.lower()
    if suffix not in SUPPORTED_EXTENSIONS:
        logger.debug("Skipping unsupported file type: %s", file_path.name)
        return None

    try:
        if suffix == ".txt":
            raw_text = _load_txt(file_path)
        elif suffix == ".pdf":
            raw_text = _load_pdf(file_path)
        else:
            return None

        metadata, body = parse_metadata(file_path, raw_text)
        logger.info("Loaded: %s (%s)", metadata.source_id, file_path.name)
        return metadata, body

    except ValueError as e:
        logger.warning("Metadata error in %s: %s", file_path.name, e)
        return None
    except Exception as e:
        logger.error("Failed to load %s: %s", file_path.name, e)
        return None


def load_all_documents(
    documents_dir: Path,
) -> Generator[tuple[DocumentMetadata, str], None, None]:
    """
    Recursively walk the documents directory and yield (metadata, body)
    for each valid document found.

    Directory structure expected:
      documents/
        dgms/       ← DGMS circulars and technical notes
        regulations/ ← Mines Act, CMR excerpts
        sops/       ← CCL SOPs
        reports/    ← Shift reports and audit checklists
    """
    if not documents_dir.exists():
        raise FileNotFoundError(
            f"Documents directory not found: {documents_dir}\n"
            "Ensure the 'documents/' directory exists relative to the project root."
        )

    files = sorted(documents_dir.rglob("*"))
    doc_files = [f for f in files if f.is_file() and f.suffix.lower() in SUPPORTED_EXTENSIONS]

    logger.info("Found %d document files in %s", len(doc_files), documents_dir)

    for file_path in doc_files:
        result = load_document(file_path)
        if result is not None:
            yield result
