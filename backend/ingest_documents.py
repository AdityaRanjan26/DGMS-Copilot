"""
ingest_documents.py

One-shot script to ingest all documents from the documents/ directory
into SQLite. Run this once after setup, and again when new documents
are added.

Usage:
    python ingest_documents.py            # Ingest new documents only
    python ingest_documents.py --reset    # Clear the DB and re-ingest everything

The script is idempotent — running it multiple times without --reset
will skip documents that are already indexed.
"""

from __future__ import annotations
import sys
import logging
import argparse
from pathlib import Path

# Add backend/ to the path so imports work when running from any directory
sys.path.insert(0, str(Path(__file__).parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ingest")


def main():
    parser = argparse.ArgumentParser(description="DGMS Copilot — Document Ingestion")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete all existing indexed data and re-ingest from scratch.",
    )
    parser.add_argument(
        "--docs-dir",
        type=Path,
        default=None,
        help="Path to documents directory (default: ../documents relative to backend/)",
    )
    args = parser.parse_args()

    # Resolve documents directory
    if args.docs_dir:
        documents_dir = args.docs_dir.resolve()
    else:
        documents_dir = (Path(__file__).parent.parent / "documents").resolve()

    logger.info("=" * 60)
    logger.info("DGMS Copilot — Document Ingestion Pipeline")
    logger.info("=" * 60)
    logger.info("Documents directory: %s", documents_dir)

    # Import here so the path is set first
    from vectorstore.sqlite_store import SQLiteStore
    from ingestion.loader import load_all_documents
    from ingestion.chunker import chunk_document

    store = SQLiteStore()

    if args.reset:
        logger.info("--reset flag set: clearing existing collection...")
        store.reset()
        logger.info("Collection cleared.")

    logger.info("Current chunks in DB: %d", store.count())
    logger.info("-" * 60)

    # Load, chunk, and embed all documents
    total_docs = 0
    total_chunks = 0
    total_added = 0
    errors = []

    for metadata, body in load_all_documents(documents_dir):
        total_docs += 1
        logger.info(
            "Processing [%s]: %s (%s, synthetic=%s)",
            metadata.source_id,
            metadata.title[:60],
            metadata.source_type,
            metadata.synthetic,
        )

        try:
            chunks = chunk_document(metadata, body)
            total_chunks += len(chunks)
            logger.info("  → %d chunks generated", len(chunks))

            added = store.add_chunks(chunks)
            total_added += added
            if added == 0:
                logger.info("  → All chunks already indexed, skipped.")
            else:
                logger.info("  → %d new chunks added to Vector Store.", added)
        except Exception as e:
            logger.error("  ✗ Failed to process %s: %s", metadata.source_id, e)
            errors.append((metadata.source_id, str(e)))

    logger.info("=" * 60)
    logger.info("INGESTION COMPLETE")
    logger.info("  Documents processed : %d", total_docs)
    logger.info("  Chunks generated    : %d", total_chunks)
    logger.info("  Chunks added to DB  : %d", total_added)
    logger.info("  Total in DB now     : %d", store.count())
    if errors:
        logger.warning("  Errors              : %d", len(errors))
        for src_id, err in errors:
            logger.warning("    - %s: %s", src_id, err)
    else:
        logger.info("  Errors              : 0")
    logger.info("=" * 60)

    if total_docs == 0:
        logger.error(
            "No documents found in %s. "
            "Ensure documents are present and have the required metadata header.",
            documents_dir,
        )
        sys.exit(1)

    logger.info("✓ Ingestion complete. Start the backend with:")
    logger.info("  uvicorn main:app --reload --port 8000")


if __name__ == "__main__":
    main()
