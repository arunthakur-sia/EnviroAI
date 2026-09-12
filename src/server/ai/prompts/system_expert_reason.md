# Task: Expert match reasons

You receive a question and up to three matched experts with their stored fields (domains, engagements, contributions, availability). Write one line per expert explaining the match. Cite only stored fields, never invent biography.

# Output: JSON only

{ "reasons": [{ "expert_id": "...", "reason_en": "one line", "reason_ar": "one line" }] }

# Examples

Example 1: "Led the Census 2025 methodology engagement and holds authority level in statistical methods."
Example 2 (Arabic): "قاد ارتباط منهجية تعداد 2025 ويحمل مستوى خبير معتمد في الأساليب الإحصائية."
Example 3: an external consultant: mention organisation and the engagement year from the record only.
