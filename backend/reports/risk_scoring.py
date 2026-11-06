import json
from rag.pipeline import search_documents
from llm.provider import get_llm_provider

def score_risks_and_compliance(hazards: list[str]) -> dict:
    """
    For the given list of hazards, search the KB for applicable DGMS regulations.
    Then determine Risk Level, Compliance Status, and Recommended Actions.
    """
    if not hazards:
        return {
            "executive_summary": "No specific hazards identified in the report. Operations appear to be proceeding normally.",
            "compliance_status": "Green",
            "detected_issues": [],
            "overall_risk_level": "Low"
        }

    evidence_blocks = []
    for hazard in hazards:
        results = search_documents(hazard, n_results=3)
        if results:
            evidence_blocks.append(f"Hazard: {hazard}\nFound DGMS Evidence: " + " | ".join([f"{r.title} - {r.section}: {r.content[:200]}" for r in results]))

    evidence_text = "\n\n".join(evidence_blocks) if evidence_blocks else "No relevant DGMS evidence found in the indexed database."

    prompt = f"""You are a senior DGMS compliance reviewer.
Based on the following extracted hazards and retrieved DGMS evidence, generate a comprehensive compliance review.
Return ONLY valid JSON matching this schema exactly (no markdown formatting, just raw JSON).
{{
  "executive_summary": "A 2-3 sentence summary of the report's compliance posture.",
  "compliance_status": "Green, Amber, or Red",
  "overall_risk_level": "Low, Medium, High, or Critical",
  "detected_issues": [
    {{
      "issue": "Description of the hazard/issue",
      "risk_level": "Low, Medium, High, or Critical",
      "why_assigned": "Why this risk level was assigned",
      "applicable_regulation": "Specific DGMS regulation cited",
      "recommended_action": "Action to fix it",
      "citation": "Source document chunk used"
    }}
  ]
}}

If evidence is insufficient to cite a specific regulation, explicitly state "No supporting DGMS guidance found" for the applicable_regulation field.
Never fabricate regulations.

HAZARDS:
{json.dumps(hazards)}

RETRIEVED DGMS EVIDENCE:
{evidence_text}
"""
    provider = get_llm_provider()
    result_text = provider.generate(prompt)
    if not result_text:
         return {"error": "Failed to generate risk scoring"}
         
    clean_json = result_text.replace("```json", "").replace("```", "").strip()
    try:
        data = json.loads(clean_json)
        return data
    except json.JSONDecodeError as e:
        print(f"Failed to parse json: {e}")
        print(f"Raw string: {clean_json}")
        return {"error": "Failed to parse risk scoring JSON"}
