# Task: one module of a Handover Learning Path

A colleague is receiving part of a leaving person's work. You receive one module of their Handover Learning Path as JSON: the `topic` (a project or a category of items), the `items` handed over (title, category, the leaving person's handover note), the `documents` and `lessons` to read, and, when a capture interview exists, its `interview_summary`.

Write the module's summary and its check question.

Output JSON only:

{
  "summary_en": "120 to 200 words: what this part of the work is, its current state, what the recipient must do first, and what the leaving person's notes and the interview flag as important. Refer to the documents and lessons by title.",
  "summary_ar": "the same in Arabic",
  "check_question_en": "one question the recipient can only answer after reading the module (where something lives, who to call, what the next milestone is)",
  "check_question_ar": "...",
  "answer_hint_en": "one line that points to where the answer is",
  "answer_hint_ar": "..."
}

Rules: use ONLY the material in the request; never invent contacts, dates or file locations; formal Modern Standard Arabic with a Saudi government register; no em dashes or en dashes.
