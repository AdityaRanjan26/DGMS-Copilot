"""
ingestion/metadata.py

Parses the YAML-like header block from each document file and returns
structured metadata. The header format is:

---
SOURCE_ID: DGMS-CIR-2024-17
TITLE: Inspection Frequency for Conveyor Belt...
SOURCE_TYPE: DGMS Circular
PAGE_COUNT: 9
PUBLICATION_DATE: 2024-03-12
SYNTHETIC: false
ISSUING_AUTHORITY: Directorate General of Mines Safety, Dhanbad
---

This format is the contract between document authors and the ingestion
pipeline. New documents must include this header. The pipeline will ingest
any document that has this header — no code changes are required to add
new documents.
"""

from __future__ import annotations
import re
from dataclasses import dataclass, field
from pathlib import Path


HEADER_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.DOTALL)


@dataclass
class DocumentMetadata:
    source_id: str
    title: str
    source_type: str
    publication_date: str
    page_count: int
    issuing_authority: str
    synthetic: bool
    file_path: str
    extra: dict = field(default_factory=dict)


def parse_metadata(file_path: Path, raw_text: str) -> tuple[DocumentMetadata, str]:
    """
    Extract metadata from the document header block and return:
      - DocumentMetadata object
      - body text (everything after the header)

    Raises ValueError if the header block is missing.
    """
    match = HEADER_RE.match(raw_text)
    if not match:
        raise ValueError(
            f"Document {file_path.name} is missing the required metadata header block "
            "(expected '---' delimited block at the start of the file)."
        )

    header_block = match.group(1)
    body = raw_text[match.end():]
    kv: dict[str, str] = {}

    for line in header_block.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if ":" in line:
            key, _, value = line.partition(":")
            kv[key.strip().upper()] = value.strip()

    def _require(key: str) -> str:
        if key not in kv:
            raise ValueError(
                f"Document {file_path.name} header is missing required field: {key}"
            )
        return kv[key]

    metadata = DocumentMetadata(
        source_id=_require("SOURCE_ID"),
        title=_require("TITLE"),
        source_type=_require("SOURCE_TYPE"),
        publication_date=kv.get("PUBLICATION_DATE", "unknown"),
        page_count=int(kv.get("PAGE_COUNT", "1")),
        issuing_authority=kv.get("ISSUING_AUTHORITY", "unknown"),
        synthetic=kv.get("SYNTHETIC", "false").lower() == "true",
        file_path=str(file_path),
        extra={k: v for k, v in kv.items()
               if k not in ("SOURCE_ID", "TITLE", "SOURCE_TYPE",
                            "PUBLICATION_DATE", "PAGE_COUNT",
                            "ISSUING_AUTHORITY", "SYNTHETIC")},
    )
    return metadata, body.strip()
