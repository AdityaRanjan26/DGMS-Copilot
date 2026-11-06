"""
api/search.py

POST /api/search — semantic document search over the DGMS corpus.

Request body:
  {
    "query": "conveyor belt inspection frequency",
    "n_results": 5,
    "source_type": null
  }

Response body:
  {
    "results": [
      {
        "id": "DGMS-CIR-2024-17",
        "title": "...",
        "type": "DGMS Circular",
        "score": "High",
        "excerpt": "...",
        "section": "...",
        "date": "2024-03-12",
        "owner": "Directorate General of Mines Safety",
        "mineContext": "..."
      }
    ],
    "total": 5,
    "query": "conveyor belt inspection frequency"
  }

The response format matches the existing searchResults data structure
in lib/platform-data.ts so the Search page renders without UI changes.
"""

from __future__ import annotations
import logging
import concurrent.futures
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from rag.pipeline import search_documents, generate_search_summary
from vectorstore.sqlite_store import SearchResult

# Shared executor for non-blocking summary generation
_summary_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1)
# Maximum seconds to wait for LLM summary before returning results without it
_SUMMARY_TIMEOUT = 8.0

logger = logging.getLogger(__name__)
router = APIRouter()

# Source type filter options (match UI badge labels)
VALID_SOURCE_TYPES = {
    "DGMS Circular",
    "DGMS Technical Note",
    "Mine SOP",
    "Central Legislation",
    "Statutory Regulations",
    "Inspection Checklist",
    "Shift Report",
}


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=500)
    n_results: int = Field(default=5, ge=1, le=20)
    source_type: str | None = Field(
        default=None,
        description="Filter by source type (e.g. 'DGMS Circular', 'Mine SOP').",
    )


class SearchResultItem(BaseModel):
    id: str
    title: str
    type: str
    score: str        # "High", "Medium", "Low" (matches existing UI badge)
    excerpt: str
    section: str
    date: str
    owner: str
    mineContext: str
    synthetic: bool
    raw_score: float


class SearchResponse(BaseModel):
    results: list[SearchResultItem]
    total: int
    query: str
    summary: str | None = None


def _score_label(score: float) -> str:
    if score >= 0.75:
        return "High"
    elif score >= 0.55:
        return "Medium"
    else:
        return "Low"


def _build_mine_context(result: SearchResult) -> str:
    """Generate a context note based on source type and synthetic flag."""
    if result.synthetic:
        return f"Synthetic document — replace with actual CCL document before production deployment."
    type_contexts = {
        "DGMS Circular": "Applicable to all mechanised mines under DGMS jurisdiction.",
        "DGMS Technical Note": "Technical guidance from DGMS Dhanbad.",
        "Mine SOP": "CCL internal operating procedure.",
        "Central Legislation": "Statutory requirement under the Mines Act, 1952.",
        "Statutory Regulations": "Requirement under Coal Mines Regulations, 2017.",
        "Inspection Checklist": "CCL compliance audit record.",
        "Shift Report": "CCL operational shift record.",
    }
    return type_contexts.get(result.source_type, "DGMS/CCL document.")


@router.post("/search", response_model=SearchResponse)
async def search(request: SearchRequest) -> SearchResponse:
    """
    Perform semantic search over the indexed DGMS document corpus.
    Returns results ranked by relevance with citation metadata.
    """
    logger.info("Search request: %s", request.query[:80])

    # Validate source type filter
    if request.source_type and request.source_type not in VALID_SOURCE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid source_type. Valid options: {sorted(VALID_SOURCE_TYPES)}",
        )

    try:
        raw_results = search_documents(
            query=request.query,
            n_results=request.n_results,
            source_type_filter=request.source_type,
        )
    except Exception as e:
        logger.exception("Search pipeline error")
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

    items: list[SearchResultItem] = []
    for r in raw_results:
        # Extract clean excerpt (remove overlap prefix)
        content = r.content
        if "[...]" in content:
            _, _, content = content.partition("[...]")
            content = content.strip()
        excerpt = content[:350].rstrip()
        if len(r.content) > 350:
            excerpt += "..."

        item = SearchResultItem(
            id=r.source_id,
            title=r.title,
            type=r.source_type,
            score=_score_label(r.score),
            excerpt=excerpt,
            section=r.section,
            date=r.publication_date,
            owner=r.issuing_authority,
            mineContext=_build_mine_context(r),
            synthetic=r.synthetic,
            raw_score=r.score,
        )
        items.append(item)

    summary = None
    if items:
        try:
            future = _summary_executor.submit(
                generate_search_summary, request.query, raw_results
            )
            summary = future.result(timeout=_SUMMARY_TIMEOUT)
        except concurrent.futures.TimeoutError:
            logger.warning("Search summary timed out after %.0fs — skipping.", _SUMMARY_TIMEOUT)
        except Exception as e:
            logger.warning("Failed to generate search summary: %s", e)

    return SearchResponse(results=items, total=len(items), query=request.query, summary=summary)
