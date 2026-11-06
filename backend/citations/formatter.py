"""
citations/formatter.py

Builds structured Citation objects from retrieved chunks.
Citations are the accountability layer of the RAG system — every
AI answer must be backed by citations that link claims to source passages.

Citation format matches the existing UI data structure in lib/platform-data.ts
so that the frontend citation panel renders correctly with real data.
"""

from __future__ import annotations
from dataclasses import dataclass
from vectorstore.sqlite_store import SearchResult


@dataclass
class Citation:
    ref: str              # e.g. "DGMS-CIR-2024-17 / Section 4.2"
    title: str            # Document title
    source_id: str        # Stable document identifier
    source_type: str      # "DGMS Circular", "Mine SOP", etc.
    section: str          # Section heading from the chunk
    page: int             # Estimated page number
    publication_date: str
    issuing_authority: str
    excerpt: str          # Short snippet of the relevant passage
    confidence: str       # "High", "Medium", "Low"
    synthetic: bool       # Whether this is a synthetic document

    def to_dict(self) -> dict:
        return {
            "ref": self.ref,
            "title": self.title,
            "source_id": self.source_id,
            "source_type": self.source_type,
            "section": self.section,
            "page": self.page,
            "publication_date": self.publication_date,
            "issuing_authority": self.issuing_authority,
            "excerpt": self.excerpt,
            "confidence": self.confidence,
            "synthetic": self.synthetic,
            # Legacy field for compatibility with existing UI citation panel
            "answerUse": f"Source retrieved with {self.confidence.lower()} confidence from {self.source_type}.",
        }


def _score_to_confidence(score: float) -> str:
    """Convert a cosine similarity score (0–1) to a human-readable confidence label."""
    if score >= 0.75:
        return "High"
    elif score >= 0.55:
        return "Medium"
    else:
        return "Low"


def _build_ref(result: SearchResult) -> str:
    """Build a compact citation reference string."""
    ref = result.source_id
    if result.section and result.section not in ("Introduction", ""):
        # Shorten section to max 60 chars for display
        section_short = result.section[:60].rstrip()
        ref = f"{ref} / {section_short}"
    return ref


def _extract_excerpt(content: str, max_length: int = 200) -> str:
    """Extract a clean excerpt from a chunk, removing the overlap prefix if present."""
    # Remove overlap marker if present
    if "[...]" in content:
        _, _, body = content.partition("[...]")
        content = body.strip()
    # Take first sentence or max_length chars
    sentences = content.split(". ")
    excerpt = sentences[0] if sentences else content
    if len(excerpt) > max_length:
        excerpt = excerpt[:max_length].rstrip() + "..."
    return excerpt.strip()


def build_citations(results: list[SearchResult]) -> list[Citation]:
    """
    Convert a list of SearchResult objects into Citation objects.

    Deduplicates by source_id — if multiple chunks from the same document
    are retrieved, only the highest-scoring chunk's section is used for
    the primary citation, but a note about the section is preserved.
    """
    seen_citations = {}
    
    for result in results:
        source_id = result.source_id
        confidence = _score_to_confidence(result.score)
        
        excerpt = _extract_excerpt(result.content)
        ref = _build_ref(result)

        citation = Citation(
            ref=ref,
            title=result.title,
            source_id=source_id,
            source_type=result.source_type,
            section=result.section,
            page=result.page,
            publication_date=result.publication_date,
            issuing_authority=result.issuing_authority,
            excerpt=excerpt,
            confidence=confidence,
            synthetic=result.synthetic,
        )

        # Deduplicate by ref (source_id + section) and excerpt, not just source_id
        # This prevents duplicate citations but allows multiple distinct sections from the same doc
        dedup_key = f"{ref}::{hash(excerpt)}"
        
        if dedup_key not in seen_citations:
            seen_citations[dedup_key] = citation
        else:
            existing = seen_citations[dedup_key]
            if _conf_rank(confidence) > _conf_rank(existing.confidence):
                seen_citations[dedup_key] = citation

    return list(seen_citations.values())


def _conf_rank(confidence: str) -> int:
    return {"High": 3, "Medium": 2, "Low": 1}.get(confidence, 0)
