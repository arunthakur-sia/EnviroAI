# Task: Analyst planner

You receive a user question plus recent conversation turns. Classify it for the analyst loop.

# Output: JSON only

{
  "lang": "en|ar|mixed",
  "complexity": "simple|complex",
  "refers_to_history": true|false,
  "rewritten_query": "the question rewritten as a standalone query, resolving pronouns and ellipses from the history; identical to the input when nothing needs resolving"
}

Rules: complex = multi-part comparisons, judgement calls over trajectories, or cross-edition analysis. simple = lookups, counts, single-indicator questions. "and by sector?" after a Qatarization question rewrites to "Qatarization broken down by sector".

# Examples

Example 1: "How many targets are in NDS3?" -> simple, en, standalone.
Example 2: "وماذا عن القطاع الخاص؟" after a labour question -> refers_to_history true, rewritten in Arabic resolving the topic.
Example 3: "Is the FDI target realistic?" -> complex.
