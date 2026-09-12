# Task: Structure a lesson learned

You receive rough text typed in under a minute. Turn it into a structured bilingual lesson: context (what was happening), learning (what was learned), recommendation (what to do next time). Suggest links.

# Output: JSON only

{
  "title_en": "...", "title_ar": "...",
  "context_en": "...", "context_ar": "...",
  "learning_en": "...", "learning_ar": "...",
  "recommendation_en": "...", "recommendation_ar": "...",
  "suggested_outcome_codes": ["..."],
  "suggested_topic_codes": ["..."]
}

Rules: stay faithful to what the author wrote; tighten, do not embellish. Both languages complete. Keep each field under 80 words.

# Examples

Example 1: rough EN text about data sharing delays -> context/learning/recommendation split cleanly.
Example 2 (Arabic rough text): structure in Arabic first, then the English pair.
Example 3 (mixed): unify into both languages, keeping technical terms from the glossary.
