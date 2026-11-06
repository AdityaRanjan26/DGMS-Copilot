"""
ingestion/chunker.py

Splits document body text into overlapping chunks while preserving
section context. Each chunk carries the full metadata needed to
generate a proper citation.

Chunking strategy:
  1. Split on double newlines (paragraph boundaries) first.
  2. If a segment is too large, split further on single newlines.
  3. If still too large, split on sentence boundaries ('. ').
  4. Merge small consecutive segments up to MAX_CHUNK_CHARS.
  5. Add OVERLAP_CHARS of context from the previous chunk.

Section detection:
  - Lines matching SECTION_PATTERN are treated as section headers.
  - Each chunk is tagged with the most recently seen section header.
  - This preserves regulatory section context in every chunk.

Page estimation:
  - Approximate 2,000 characters per page for plain text documents.
  - Chunk page is estimated from its character offset in the document.
"""

from __future__ import annotations
import re
from dataclasses import dataclass
from ingestion.metadata import DocumentMetadata

MAX_CHUNK_CHARS = 900
OVERLAP_CHARS = 150
CHARS_PER_PAGE = 2000

# Matches lines that look like section headers:
# "Section 3.1", "SECTION 4", "3. DEFINITIONS", "4.2 Belt Conveyor Safety"
SECTION_PATTERN = re.compile(
    r"^(?:SECTION\s+\d|Section\s+\d|\d+\.\s+[A-Z]|\d+\.\d+\s+[A-Z]|PART\s+[IVXLC]+|CHAPTER\s+[IVXLC]+)",
    re.IGNORECASE,
)


@dataclass
class Chunk:
    id: str
    content: str
    source_id: str
    title: str
    source_type: str
    section: str
    page: int
    publication_date: str
    issuing_authority: str
    synthetic: bool
    chunk_index: int
    file_path: str


def _detect_section(line: str) -> bool:
    return bool(SECTION_PATTERN.match(line.strip()))


def _estimate_page(char_offset: int) -> int:
    return max(1, (char_offset // CHARS_PER_PAGE) + 1)


def _split_text(text: str) -> list[str]:
    """
    Recursively split text into segments no larger than MAX_CHUNK_CHARS.
    Tries paragraph breaks → line breaks → sentence breaks → hard split.
    """
    if len(text) <= MAX_CHUNK_CHARS:
        return [text]

    # Try paragraph split
    parts = text.split("\n\n")
    if len(parts) > 1:
        result = []
        for part in parts:
            result.extend(_split_text(part.strip()))
        return [p for p in result if p]

    # Try line split
    parts = text.split("\n")
    if len(parts) > 1:
        result = []
        for part in parts:
            result.extend(_split_text(part.strip()))
        return [p for p in result if p]

    # Try sentence split
    parts = re.split(r"(?<=\.) ", text)
    if len(parts) > 1:
        result = []
        for part in parts:
            result.extend(_split_text(part.strip()))
        return [p for p in result if p]

    # Hard split as last resort
    return [text[:MAX_CHUNK_CHARS], text[MAX_CHUNK_CHARS:]]


def chunk_document(metadata: DocumentMetadata, body: str) -> list[Chunk]:
    """
    Chunk a document body into Chunk objects, each carrying full citation metadata.
    """
    chunks: list[Chunk] = []
    current_section = "Introduction"
    segments: list[str] = []
    current_segment = ""
    char_offset = 0

    # Track sections as we pass them
    lines = body.split("\n")
    section_map: list[tuple[int, str]] = []  # (char_offset, section_name)
    running_offset = 0

    for line in lines:
        if _detect_section(line):
            section_map.append((running_offset, line.strip()))
        running_offset += len(line) + 1

    def _section_at_offset(offset: int) -> str:
        """Return the section name active at a given character offset."""
        active = "Introduction"
        for sec_offset, sec_name in section_map:
            if sec_offset <= offset:
                active = sec_name
            else:
                break
        return active

    # Build initial segments by paragraph
    raw_segments = _split_text(body)

    # Merge small segments into chunks of up to MAX_CHUNK_CHARS
    merged: list[tuple[str, int]] = []  # (text, char_offset)
    running_offset = 0
    current_text = ""
    current_start = 0

    for seg in raw_segments:
        if not seg.strip():
            running_offset += len(seg) + 2
            continue

        if len(current_text) + len(seg) + 1 <= MAX_CHUNK_CHARS:
            current_text = (current_text + " " + seg).strip() if current_text else seg
        else:
            if current_text:
                merged.append((current_text, current_start))
            current_text = seg
            current_start = running_offset
        running_offset += len(seg) + 2

    if current_text:
        merged.append((current_text, current_start))

    # Build Chunk objects with overlap
    for i, (text, offset) in enumerate(merged):
        # Add overlap from previous chunk
        if i > 0:
            prev_text = merged[i - 1][0]
            overlap = prev_text[-OVERLAP_CHARS:] if len(prev_text) > OVERLAP_CHARS else prev_text
            content = overlap + " [...] " + text
        else:
            content = text

        section = _section_at_offset(offset)
        page = _estimate_page(offset)

        # Inject extra metadata into the content for semantic indexing
        if i == 0 and metadata.extra:
            meta_text = "\n\n[Document Metadata: "
            meta_text += ", ".join(f"{k}={v}" for k, v in metadata.extra.items())
            meta_text += "]"
            content += meta_text

        chunk = Chunk(
            id=f"{metadata.source_id.lower()}-chunk-{i:04d}",
            content=content.strip(),
            source_id=metadata.source_id,
            title=metadata.title,
            source_type=metadata.source_type,
            section=section,
            page=page,
            publication_date=metadata.publication_date,
            issuing_authority=metadata.issuing_authority,
            synthetic=metadata.synthetic,
            chunk_index=i,
            file_path=metadata.file_path,
        )
        chunks.append(chunk)

    return chunks
