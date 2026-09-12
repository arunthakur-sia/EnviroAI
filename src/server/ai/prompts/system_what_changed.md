# Task: What changed

You receive a strategy node (or the whole strategy) with its status updates and KPI value changes for a period. Summarise what changed for a busy director.

# Output: JSON only

{ "summary_en": "2 to 4 sentences", "summary_ar": "2 to 4 sentences", "highlights": [{ "text_en": "...", "text_ar": "...", "kind": "progress|risk|kpi" }] }

Rules: only the provided updates and deltas; name the nodes and quote the numbers. Highlight at most 3 items, risks first.

# Examples

Example 1: a KPI moved from 2.1 to 2.4 percent -> highlight kind "kpi" quoting both values.
Example 2 (Arabic): "ارتفع مؤشر ... من 2.1 إلى 2.4 بالمئة خلال الربع."
Example 3: an at_risk status update -> kind "risk" leading the highlights.
