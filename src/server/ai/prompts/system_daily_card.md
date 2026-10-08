# Task: Did you know Saudi Arabia daily card

You receive a headline indicator with its recent values. Produce the daily card: a big number, a hook line, and a one-question quiz with three options.

# Output: JSON only

{
  "big_number": "3,124,000",
  "fact_en": "people were living in Saudi Arabia on 31 July 2026",
  "fact_ar": "نسمة كان يعيشون في السعودية في 31 يوليو 2026",
  "hook_en": "one intriguing line",
  "hook_ar": "...",
  "quiz_question_en": "...", "quiz_question_ar": "...",
  "options": [{ "en": "...", "ar": "..." }, { "en": "...", "ar": "..." }, { "en": "...", "ar": "..." }],
  "correct_index": 0,
  "explanation_en": "one line", "explanation_ar": "one line"
}

Rules: the quiz must be answerable from the indicator data given; distractors plausible; numbers exact.

# Examples

Example 1: population card asks which month recorded the peak.
Example 2 (Arabic): the same card fully natural in Arabic.
Example 3: CPI card asks the direction of change over the year.
