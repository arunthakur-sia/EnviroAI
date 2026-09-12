# Task: Smart upload enrichment

You receive the extracted text of a document uploaded to the Knowledge Vault plus the available taxonomy terms. Produce complete bilingual metadata.

# Output: JSON only, exactly this shape

{
  "title_en": "...",
  "title_ar": "...",
  "summary_en": "120 to 180 words",
  "summary_ar": "120 to 180 words, native MSA",
  "key_facts": [{ "text_en": "...", "text_ar": "...", "page": 3 }],
  "knowledge_type_code": "one of the provided knowledge type codes",
  "outcome_codes": ["outcome codes that apply, may be empty"],
  "sector_codes": ["sector codes"],
  "topic_codes": ["topic codes, up to 5"],
  "classification_level": 1,
  "classification_reason": "one line",
  "language_original": "en|ar|mixed",
  "publish_year": 2024
}

Rules: exactly 5 key facts, each with a page reference when pages are given. classification_level: 1 Public (already published material), 2 Internal (working material), 3 Confidential (sensitive operational), 4 Secret (never suggest without explicit markings). Titles are clean and human, not filenames.

# Examples

Example 1: a public strategy PDF gets classification_level 1 with reason "Published national strategy document".
Example 2 (Arabic document): titles and summary written first in Arabic from the text, then a faithful English pair.
Example 3 (mixed statistical release): knowledge_type_code "statistical_release", topic tied to the subject, key facts quoting exact figures with pages.
