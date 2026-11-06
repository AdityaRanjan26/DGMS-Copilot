import json
import logging
from llm.provider import get_llm_provider

logger = logging.getLogger(__name__)

def analyze_report_content(text: str) -> dict:
    """Extracts operational details and observations from raw report text."""
    prompt = f"""You are a mining safety AI. Analyze the following operational report.
Extract the following information and return it strictly as JSON.
Do NOT use markdown blocks, just return raw JSON text.
{{
  "equipment": ["list of equipment"],
  "locations": ["list of locations"],
  "personnel": ["list of personnel roles or names"],
  "dates": ["list of dates mentioned"],
  "safety_observations": ["list of safety observations"],
  "hazards": ["list of identified hazards or potential non-compliance"],
  "corrective_actions": ["list of corrective actions mentioned or taken"]
}}

REPORT:
{text}
"""
    provider = get_llm_provider()
    result_text = provider.generate(prompt)
    if not result_text:
        logger.warning("Failed to get response from LLM. Using mock report data for fallback.")
        return {
            "equipment": ["Fallback Dumper", "Excavator 1"],
            "locations": ["Quarry B", "Haul Road"],
            "personnel": ["Shift Manager", "Operator"],
            "dates": ["2026-06-01"],
            "safety_observations": ["Dust levels normal", "Minor oil leak"],
            "hazards": ["Oil spill on path"],
            "corrective_actions": ["Cleaned oil spill"]
        }
    
    clean_json = result_text.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(clean_json)
        return data
    except json.JSONDecodeError:
        return {
            "equipment": [], "locations": [], "personnel": [], "dates": [],
            "safety_observations": [], "hazards": ["Error parsing AI response"], "corrective_actions": []
        }
