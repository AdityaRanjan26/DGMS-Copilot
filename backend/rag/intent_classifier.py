"""
rag/intent_classifier.py

Hybrid two-stage intent classifier:
  Stage 1: Fast rule-based detection for obvious cases (greetings, identity, etc.)
  Stage 2: LLM-based classification for ambiguous queries

Intents:
  GREETING      — hi, hello, namaste, kaise ho
  SMALLTALK     — thanks, good morning, how are you, bye
  IDENTITY      — who are you, what can you do, explain yourself
  COMPLIANCE    — DGMS rules, belt inspection, ventilation, PPE, safety regulations
  GENERAL       — general knowledge questions (answer naturally, no RAG needed)
  FOLLOWUP      — references previous turn (this, that, second point, upar wala)
  OUT_OF_SCOPE  — unsafe / harmful content

The classifier never blocks general knowledge questions.
Only COMPLIANCE triggers the RAG pipeline.
"""

from __future__ import annotations
import re
import logging
from enum import Enum

logger = logging.getLogger(__name__)


class Intent(str, Enum):
    GREETING = "GREETING"
    SMALLTALK = "SMALLTALK"
    IDENTITY = "IDENTITY"
    COMPLIANCE = "COMPLIANCE"
    GENERAL = "GENERAL"
    FOLLOWUP = "FOLLOWUP"
    OUT_OF_SCOPE = "OUT_OF_SCOPE"


# ── Stage 1: Rule-based fast detection ──────────────────────────────────────

_GREETING_PATTERNS = [
    r"^\s*(hi|hello|hey|hii|helo|heya|hiya|yo)\s*[!?.]*\s*$",
    r"^\s*(namaste|namaskar|pranam|salaam|salam|vanakkam)\s*[!?.]*\s*$",
    r"^\s*(good\s*(morning|afternoon|evening|night)|shubh\s*(prabhat|sandhya|ratri))\s*[!?.]*\s*$",
    r"^\s*(kaise\s*ho|kya\s*haal|kaisa\s*chal|how\s*are\s*you|wassup|what'?s\s*up)\s*[!?.]*\s*$",
    r"^\s*(hola|bonjour|ciao|howdy)\s*[!?.]*\s*$",
]

_SMALLTALK_PATTERNS = [
    r"^\s*(thanks?|thank\s*you|shukriya|dhanyawad|shukriya|mehrbani|shukran)\s*[!.]*\s*$",
    r"^\s*(bye|goodbye|alvida|phir\s*milenge|take\s*care|see\s*you)\s*[!.]*\s*$",
    r"^\s*(ok|okay|theek\s*hai|thik\s*hai|acha|accha|sure|got\s*it|understood)\s*[!.]*\s*$",
    r"^\s*(great|nice|awesome|perfect|wonderful|bahut\s*achha|shabash)\s*[!.]*\s*$",
    r"^\s*(i'?m\s*(fine|good|okay|great)|main\s*(theek|sahi)\s*(hoon|hu))\s*[!.]*\s*$",
]

_IDENTITY_PATTERNS = [
    r"\b(who\s*are\s*you|aap\s*kaun\s*hain?|tum\s*kaun\s*ho|what\s*are\s*you)\b",
    r"\b(what\s*can\s*you\s*do|kya\s*kar\s*sakte\s*ho|aapki\s*capabilities|your\s*capabilities)\b",
    r"\b(introduce\s*yourself|apna\s*parichay\s*do|tell\s*me\s*about\s*yourself)\b",
    r"\b(explain\s*yourself|how\s*do\s*you\s*work|aap\s*kaise\s*kaam\s*karte)\b",
    r"\b(what\s*is\s*dgms\s*copilot|about\s*this\s*(app|platform|assistant))\b",
    r"\b(help|mujhe\s*madad\s*chahiye|kya\s*help\s*mil\s*sakti)\b",
]

_FOLLOWUP_PATTERNS = [
    r"\b(this|that|it|these|those|the\s*above|upar\s*wala|yeh|woh)\b",
    r"\b(second\s*point|third\s*point|first\s*one|last\s*one|dusra\s*point|teesra)\b",
    r"\b(what\s*do\s*you\s*mean|explain\s*(more|further|again)|aur\s*batao|samjhao)\b",
    r"\b(continue|go\s*on|aage\s*batao|tell\s*me\s*more|more\s*details)\b",
    r"\b(why\s*(that|this|so)|iska\s*kya\s*matlab|phir\s*kya)\b",
]

_COMPLIANCE_KEYWORDS = [
    # English
    "dgms", "ccl", "mines act", "cmr", "regulation", "circular", "sop",
    "inspection", "conveyor", "belt", "ventilation", "ppe", "safety",
    "haul road", "dumper", "blasting", "explosive", "fire", "dust",
    "gas", "oxygen", "shift report", "compliance", "audit",
    "pull cord", "emergency stop", "guarding", "spillage", "illumination",
    "mine manager", "overman", "foreman", "colliery", "opencast", "underground",
    "winding", "shaft", "seam", "pillar", "barrier", "support", "timbering",
    "electrical", "detonator", "stemming", "misfire", "shot firer",
    # Hindi / Hinglish
    "khadan", "suraksha", "niyam", "pravidhan", "nirdeshan", "sanchalak",
    "conveyor belt", "belt ki janch", "belt inspection", "ventilation check",
    "safety niyam", "suraksha niyam", "ppe pahanna", "helmet", "safety boots",
    "pull cord check", "fire extinguisher", "khataranak", "durghatna",
    # Devanagari Hindi
    "सुरक्षा", "खान", "खदान", "नियम", "विनियमन", "परिपत्र", "विस्फोटक", "विस्फोट",
    "ब्लास्टिंग", "कन्वेयर", "बेल्ट", "वेंटिलेशन", "हॉल रोड", "डंपर", "निरीक्षण",
    "पीपीई", "ऑडिट", "रिपोर्ट", "ओवरमैन", "मैनेजर", "गैस", "आपातकालीन", "दुर्घटना",
    "आग", "धूल", "उपकरण", "प्रावधान", "दस्तावेज़", "अधिनियम", "कोलियरी", "करो",
]

_COMPLIANCE_PATTERNS = [
    r"\b(inspect|inspection|check|checking|janch|pariksha)\b.*\b(belt|conveyor|ventilation|shaft|ppe|equipment)\b",
    r"\b(how\s*often|frequency|kitni\s*baar|har\s*kitne)\b",
    r"\b(regulation|rule|niyam|pravidhan|circular|sop|guideline)\b",
    r"\b(penalty|fine|violation|action|karyawahi|saza)\b",
    r"\b(certificate|license|permit|permission|anumati)\b.*\b(mine|mining|excavation)\b",
    r"\b(dgms|directorate\s*general\s*of\s*mines\s*safety)\b",
    r"\b(mine|mining|colliery|opencast|ocp|underground)\b.*\b(safety|suraksha|rule|niyam)\b",
]

_OUT_OF_SCOPE_PATTERNS = [
    r"\b(how\s*to\s*(hack|crack|bypass|steal|kill|harm|hurt))\b",
    r"\b(make\s*(bomb|weapon|drug|poison))\b",
    r"\b(illegal|unlawful|cheat|fraud|bribe)\b.*\b(mine|dgms|officer)\b",
]

_compiled_greeting = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _GREETING_PATTERNS]
_compiled_smalltalk = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _SMALLTALK_PATTERNS]
_compiled_identity = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _IDENTITY_PATTERNS]
_compiled_followup = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _FOLLOWUP_PATTERNS]
_compiled_compliance = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _COMPLIANCE_PATTERNS]
_compiled_oos = [re.compile(p, re.IGNORECASE | re.UNICODE) for p in _OUT_OF_SCOPE_PATTERNS]


def _matches_any(text: str, patterns: list) -> bool:
    return any(p.search(text) for p in patterns)


def _has_compliance_keyword(text: str) -> bool:
    lower = text.lower()
    return any(kw in lower for kw in _COMPLIANCE_KEYWORDS)


def classify_intent(question: str, history: list[dict] | None = None) -> Intent:
    """
    Classify the intent of a question.

    Args:
        question: The user's question text
        history: Previous conversation turns [{role, content}]

    Returns:
        Intent enum value
    """
    q = question.strip()
    q_lower = q.lower()

    # 1. Out of scope (safety check first)
    if _matches_any(q, _compiled_oos):
        return Intent.OUT_OF_SCOPE

    # 2. Greeting (very short queries only)
    if len(q.split()) <= 6 and _matches_any(q, _compiled_greeting):
        return Intent.GREETING

    # 3. Small talk (short queries)
    if len(q.split()) <= 8 and _matches_any(q, _compiled_smalltalk):
        return Intent.SMALLTALK

    # 4. Identity questions
    if _matches_any(q, _compiled_identity):
        return Intent.IDENTITY

    # 5. Follow-up (only if there's history to follow up on)
    if history and len(history) >= 2:
        if len(q.split()) <= 12 and _matches_any(q, _compiled_followup):
            return Intent.FOLLOWUP

    # 6. Compliance — keyword or pattern match
    if _has_compliance_keyword(q_lower) or _matches_any(q, _compiled_compliance):
        return Intent.COMPLIANCE

    # 7. Short queries with no compliance context → general
    if len(q.split()) <= 5:
        return Intent.GENERAL

    # 8. Default: general knowledge (answer naturally)
    # The pipeline will try RAG first; if low confidence, it falls back to general answer
    return Intent.GENERAL


# ── Canned responses ──────────────────────────────────────────────────────────

_GREETING_RESPONSES = {
    "en": (
        "Hello! I'm the DGMS Copilot — your AI assistant for mining compliance and safety. "
        "I can help you with DGMS circulars, SOPs, inspection requirements, PPE rules, and "
        "general questions too. What can I help you with today?"
    ),
    "hi": (
        "नमस्ते! मैं DGMS Copilot हूँ — खनन सुरक्षा और अनुपालन के लिए आपका AI सहायक। "
        "मैं DGMS सर्कुलर, SOP, निरीक्षण नियम, PPE और सामान्य प्रश्नों में भी मदद कर सकता हूँ। "
        "आज मैं आपकी कैसे सहायता कर सकता हूँ?"
    ),
}

_SMALLTALK_RESPONSES_EN = [
    "You're welcome! Feel free to ask any mining safety or compliance questions.",
    "Happy to help! Is there anything specific about DGMS regulations you'd like to know?",
    "Sounds good! Let me know if you have any compliance or safety questions.",
    "Take care! Come back anytime you need help with mining safety regulations.",
    "Got it! What else can I help you with?",
]

_SMALLTALK_RESPONSES_HI = [
    "आपका स्वागत है! खनन सुरक्षा या अनुपालन से जुड़े कोई भी प्रश्न पूछें।",
    "खुशी से! क्या DGMS नियमों के बारे में कुछ जानना चाहते हैं?",
    "बिल्कुल! अगर कोई सुरक्षा या अनुपालन प्रश्न हो तो बताएं।",
    "ठीक है! और कोई सहायता चाहिए तो बताएं।",
    "धन्यवाद! कोई और सवाल हो तो जरूर पूछें।",
]

_IDENTITY_RESPONSES = {
    "en": (
        "I'm **DGMS Copilot** — an AI assistant built for Central Coalfields Limited (CCL) mine safety "
        "officers and compliance teams.\n\n"
        "**What I can do:**\n"
        "- Answer questions about DGMS circulars, Coal Mines Regulations 2017, and CCL SOPs\n"
        "- Help with inspection frequencies, PPE requirements, ventilation rules, and safety procedures\n"
        "- Analyze shift reports for compliance findings\n"
        "- Search indexed DGMS documents with clause-level citations\n"
        "- Answer general questions too\n\n"
        "> **Practical Tip**\n"
        "> Try asking: *\"What is the belt conveyor inspection frequency?\"* or "
        "*\"DGMS rule for PPE during blasting?\"*"
    ),
    "hi": (
        "मैं **DGMS Copilot** हूँ — Central Coalfields Limited (CCL) के खनन सुरक्षा अधिकारियों "
        "और अनुपालन टीमों के लिए बना AI सहायक।\n\n"
        "**मैं क्या कर सकता हूँ:**\n"
        "- DGMS सर्कुलर, Coal Mines Regulations 2017 और CCL SOPs के बारे में जवाब देना\n"
        "- निरीक्षण आवृत्ति, PPE नियम, वेंटिलेशन और सुरक्षा प्रक्रियाओं में मदद\n"
        "- अनुपालन निष्कर्षों के लिए शिफ्ट रिपोर्ट का विश्लेषण\n"
        "- उद्धरण-स्तरीय DGMS दस्तावेज़ खोज\n"
        "- सामान्य प्रश्नों के उत्तर भी\n\n"
        "> **Practical Tip**\n"
        "> पूछें: *\"Conveyor belt inspection kitni baar karni chahiye?\"* या "
        "*\"Blasting ke dauran PPE ka DGMS niyam kya hai?\"*"
    ),
}

_OOS_RESPONSE = {
    "en": (
        "I'm sorry, I can't help with that. I'm designed to assist with mining safety, "
        "compliance, and general questions. Is there something about DGMS regulations or "
        "mine safety I can help you with?"
    ),
    "hi": (
        "मुझे खेद है, मैं इसमें मदद नहीं कर सकता। मैं खनन सुरक्षा, अनुपालन "
        "और सामान्य प्रश्नों के लिए बना हूँ। क्या कोई DGMS नियम या सुरक्षा संबंधी "
        "प्रश्न पूछना चाहते हैं?"
    ),
}

import random


def get_canned_response(intent: Intent, language: str = "en") -> str | None:
    """Return a canned response for non-RAG intents, or None if RAG should handle it."""
    lang = "hi" if language == "hi" else "en"

    if intent == Intent.GREETING:
        return _GREETING_RESPONSES.get(lang, _GREETING_RESPONSES["en"])

    if intent == Intent.SMALLTALK:
        responses = _SMALLTALK_RESPONSES_HI if lang == "hi" else _SMALLTALK_RESPONSES_EN
        return random.choice(responses)

    if intent == Intent.IDENTITY:
        return _IDENTITY_RESPONSES.get(lang, _IDENTITY_RESPONSES["en"])

    if intent == Intent.OUT_OF_SCOPE:
        return _OOS_RESPONSE.get(lang, _OOS_RESPONSE["en"])

    return None  # RAG or LLM should handle COMPLIANCE, GENERAL, FOLLOWUP
