"""
rag/hinglish_normalizer.py

Normalize Hinglish (Roman Hindi + English hybrid) queries before embedding.

This transforms mixed-language mining queries into clean English that the
embedding model understands well, without changing the user's displayed question.

Only applied to the RETRIEVAL query — the LLM still sees the original question
and responds in the user's language.

Examples:
  "belt inspection kab karna hota hai" → "conveyor belt inspection frequency"
  "DGMS belt rule batao"               → "DGMS belt conveyor safety rules"
  "pull cord check karna chahiye"      → "pull cord check requirement"
  "PPE kab pahenna chahiye"            → "PPE wearing requirements when"
  "ventilation check kab"             → "ventilation check frequency"
"""

from __future__ import annotations
import re
import logging

logger = logging.getLogger(__name__)


# ── Hinglish → English translation map ────────────────────────────────────────
# Format: (regex_pattern, replacement)
# Applied in order — later rules can build on earlier ones

_TRANSLATIONS: list[tuple[str, str]] = [
    # Question words
    (r"\bkab\b", "when"),
    (r"\bkaise\b", "how"),
    (r"\bkya\b", "what"),
    (r"\bkyun\b", "why"),
    (r"\bkitna\b", "how much"),
    (r"\bkitni\b", "how many"),
    (r"\bkitne\b", "how many"),
    (r"\bkahan\b", "where"),
    (r"\bkaun\b", "who"),
    (r"\bkoi\b", "any"),
    (r"\bkuch\b", "some"),

    # Verb forms
    (r"\bkarna\s*hota\s*hai\b", "should be done"),
    (r"\bkarna\s*chahiye\b", "should be done"),
    (r"\bkarna\s*hai\b", "needs to be done"),
    (r"\bkarni\s*chahiye\b", "should be done"),
    (r"\bkarni\s*hai\b", "needs to be done"),
    (r"\bkarte\s*hain\b", "is done"),
    (r"\bkarta\s*hai\b", "is done"),
    (r"\bhotа\s*hai\b", "happens"),
    (r"\bhota\s*hai\b", "happens"),
    (r"\bhoti\s*hai\b", "happens"),
    (r"\bhain\b", "are"),
    (r"\bhai\b", "is"),
    (r"\bthe\b(?!\s+[a-z])", "were"),  # Don't remove English "the"
    (r"\btha\b", "was"),
    (r"\bthi\b", "was"),
    (r"\bbatao\b", "explain"),
    (r"\bbataiye\b", "explain"),
    (r"\bsamjhao\b", "explain"),
    (r"\bdekhna\b", "check"),
    (r"\bdekhein\b", "check"),
    (r"\bpadhna\b", "read"),
    (r"\blikhna\b", "write"),
    (r"\blagana\b", "apply"),
    (r"\bhona\b", "to be"),
    (r"\bkarna\b", "to do"),
    (r"\bkaro\b", "do"),
    (r"\bkijiye\b", "please do"),
    (r"\bpahenna\b", "wearing"),
    (r"\bpahno\b", "wear"),
    (r"\blena\b", "take"),
    (r"\bdena\b", "give"),
    (r"\bfolllow\b", "follow"),
    (r"\bjaanch\b", "check"),
    (r"\bjanch\b", "check"),

    # Particles and conjunctions
    (r"\baur\b", "and"),
    (r"\bya\b", "or"),
    (r"\bse\b", "from"),
    (r"\bmein\b", "in"),
    (r"\bpar\b", "on"),
    (r"\bka\b", "of"),
    (r"\bki\b", "of"),
    (r"\bke\b", "of"),
    (r"\bko\b", "to"),
    (r"\bne\b", ""),
    (r"\bwala\b", "related"),
    (r"\bwali\b", "related"),
    (r"\bnahi\b", "not"),
    (r"\bnahi\b", "not"),
    (r"\bnahin\b", "not"),
    (r"\bsirf\b", "only"),
    (r"\bbhi\b", "also"),
    (r"\bab\b", "now"),
    (r"\bphir\b", "then"),
    (r"\bpehle\b", "before"),
    (r"\bbaad\b", "after"),
    (r"\bsaath\b", "with"),
    (r"\bbina\b", "without"),
    (r"\bwaqt\b", "time"),
    (r"\bsamy\b", "time"),
    (r"\bsamay\b", "time"),
    (r"\bhar\b", "every"),
    (r"\bprati\b", "per"),

    # Mining-specific terms
    (r"\bkhadaan\b", "mine"),
    (r"\bkhadan\b", "mine"),
    (r"\bkhani\b", "mine"),
    (r"\bsurakh\b", "borehole"),
    (r"\bsuraksha\b", "safety"),
    (r"\bsuraksh(a|it)\b", "safe"),
    (r"\bniyam\b", "rule"),
    (r"\bniyamon\b", "rules"),
    (r"\bpravidhan\b", "provision"),
    (r"\bpravdhan\b", "provision"),
    (r"\bnirdeshan\b", "directive"),
    (r"\baandesha\b", "hazard"),
    (r"\bkhatarnak\b", "hazardous"),
    (r"\bkhatrа\b", "danger"),
    (r"\bkhatra\b", "danger"),
    (r"\bkhatara\b", "hazard"),
    (r"\bdurghatna\b", "accident"),
    (r"\bhादsa\b", "accident"),
    (r"\bhadsa\b", "accident"),
    (r"\bavasar\b", "frequency"),
    (r"\baawaiti\b", "frequency"),
    (r"\baawrtti\b", "frequency"),
    (r"\baavritti\b", "frequency"),
    (r"\bjanch\b", "inspection"),
    (r"\bnirikshan\b", "inspection"),
    (r"\bnirikshaण\b", "inspection"),
    (r"\bpariiksha\b", "inspection"),
    (r"\bprariksha\b", "inspection"),
    (r"\baaग\b", "fire"),
    (r"\baag\b", "fire"),
    (r"\bdhool\b", "dust"),
    (r"\bdhool\b", "dust"),
    (r"\bgaas\b", "gas"),
    (r"\bpani\b", "water"),
    (r"\bbijli\b", "electrical"),
    (r"\bvidyut\b", "electrical"),

    # Common Hinglish phrases in mining context
    (r"\bbelt\s*ki\s*janch\b", "belt inspection"),
    (r"\bbelt\s*janch\b", "belt inspection"),
    (r"\bconveyor\s*ki\s*janch\b", "conveyor belt inspection"),
    (r"\bppe\s*pahenna\b", "ppe wearing requirement"),
    (r"\bppe\s*pahno\b", "wear ppe"),
    (r"\bventilation\s*janch\b", "ventilation inspection"),
    (r"\bshift\s*mein\b", "per shift"),
    (r"\bhar\s*shift\b", "every shift"),
    (r"\bhar\s*shift\b", "every shift"),
]

# Compile once
_compiled_translations = [
    (re.compile(pattern, re.IGNORECASE | re.UNICODE), replacement)
    for pattern, replacement in _TRANSLATIONS
]


def normalize_hinglish(query: str) -> str:
    """
    Normalize a Hinglish query to clean English for better embedding retrieval.
    Returns the original query if it appears to be pure English already.

    The original query is preserved for display and LLM prompting.
    Only use this normalized version for the vector store search.
    """
    # Quick check: if it's mostly Devanagari script, don't try to normalize
    devanagari_chars = sum(1 for c in query if '\u0900' <= c <= '\u097F')
    if devanagari_chars > len(query) * 0.3:
        # Mostly Devanagari — transliteration is complex, pass through
        logger.debug("Devanagari query — skipping normalization: %s", query[:60])
        return query

    # Check if it contains any Hinglish markers
    has_hinglish = any(
        re.search(pattern, query, re.IGNORECASE)
        for pattern, _ in _TRANSLATIONS[:20]  # Check first 20 patterns (most common)
    )

    if not has_hinglish:
        return query  # Pure English — no normalization needed

    normalized = query
    for pattern, replacement in _compiled_translations:
        normalized = pattern.sub(replacement, normalized)

    # Clean up multiple spaces
    normalized = re.sub(r'\s+', ' ', normalized).strip()

    if normalized != query:
        logger.info("Hinglish normalized: %r → %r", query[:60], normalized[:60])

    return normalized


def detect_language(text: str) -> str:
    """
    Detect whether text is primarily Hindi, English, or Hinglish.

    Returns: 'hi', 'en', or 'hinglish'
    """
    devanagari = sum(1 for c in text if '\u0900' <= c <= '\u097F')
    total_chars = len(text.replace(' ', ''))

    if total_chars == 0:
        return 'en'

    devanagari_ratio = devanagari / total_chars

    # Check for common Hinglish markers in Roman script
    hinglish_words = [
        'kab', 'kaise', 'kya', 'hai', 'hain', 'karo', 'batao', 'nahi',
        'aur', 'ya', 'ka', 'ki', 'ke', 'ko', 'mein', 'wala',
    ]
    words = text.lower().split()
    hinglish_count = sum(1 for w in words if w in hinglish_words)
    hinglish_ratio = hinglish_count / max(len(words), 1)

    if devanagari_ratio > 0.5:
        return 'hi'
    elif devanagari_ratio > 0.1 or hinglish_ratio > 0.2:
        return 'hinglish'
    else:
        return 'en'
