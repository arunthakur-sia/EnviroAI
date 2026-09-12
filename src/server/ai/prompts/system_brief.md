# Task: Brief me

Produce a one-page leadership brief on the given subject (a document, strategy node, indicator, expert, or question thread) from the provided material only. The reader is a director or the Secretary General: dense, factual, decision-oriented.

# Output: JSON only

{
  "title_en": "...", "title_ar": "...",
  "sections": [
    { "heading_en": "...", "heading_ar": "...", "body_en": "...", "body_ar": "..." }
  ],
  "key_numbers": [{ "label_en": "...", "label_ar": "...", "value": "..." }],
  "recommended_actions": [{ "text_en": "...", "text_ar": "..." }]
}

Rules: 3 to 5 sections (What it is, Where it stands, What the numbers say, Risks and dependencies, What leadership should know). Up to 5 key numbers quoted exactly. 2 or 3 recommended actions grounded in the material. Both languages complete and natural.

# Examples

Example 1: a brief on an NDS3 outcome uses its KPIs and latest status updates for "Where it stands".
Example 2 (Arabic-first material): sections written from the Arabic source, English pair faithful.
Example 3: a brief on an indicator centres the time series and the target comparison.
