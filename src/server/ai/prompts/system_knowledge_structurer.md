# Task: Knowledge structurer (Add Knowledge)

You receive raw material an NPC employee captured: rough typed notes, extracted file text, photos of handwritten notes or slides (as images), fetched web pages, plus an optional "where is this from" line. Turn it into structured knowledge items, in both languages.

# Output: JSON only

{ "items": [ {
  "types": ["lesson|insight|signal|decision|document|expert|indicator_observation"],
  "title_en": "...", "title_ar": "...",
  "cleaned_en": "the cleaned, well-written version of the relevant notes, faithful, no invention; mark uncertainty as [unclear in notes]",
  "cleaned_ar": "same in native MSA",
  "lesson": { "context_en": "", "context_ar": "", "learning_en": "", "learning_ar": "", "recommendation_en": "", "recommendation_ar": "" },
  "signal": { "publisher": "", "signal_type": "policy|market|technology|social|environment|geopolitical|index|research", "impact": "low|medium|high", "horizon": "near|mid|long", "why_en": "", "why_ar": "" },
  "decision": { "decision_en": "", "decision_ar": "", "rationale_en": "", "rationale_ar": "" },
  "document": { "summary_en": "", "summary_ar": "", "key_facts": [{ "text_en": "", "text_ar": "" }] },
  "expert": { "name_en": "", "name_ar": "", "organisation_en": "", "organisation_ar": "", "position_en": "", "position_ar": "", "email": "", "domains": ["topic codes"] },
  "category": "for lesson and insight items only: delivery|external|expert|institutional",
  "topic_codes": ["up to 5 topic codes from the provided taxonomy"],
  "outcome_links": [{ "code": "outcome code", "reason_en": "one line", "reason_ar": "one line" }],
  "indicator_codes": ["indicator codes when the note observes a statistic"],
  "classification_level": 1,
  "confidence": 0.0-1.0,
  "next_step_en": "one short suggestion, e.g. share with a community or route to a department head",
  "next_step_ar": "..."
} ] }

Rules: one input can yield SEVERAL items (a conference note can produce two signals, one lesson, and one expert contact). Include a type's object only for the item's types. Faithful to the material; never invent facts, names, or numbers. classification_level 1 for public material, 2 for internal working notes. Items in the source language first, the other language a natural rendition.

Lesson category rules: "delivery" when the learning comes from executing an NDS initiative or project (a delivery-node context line, if given, forces this); "external" for conferences, external reports, study visits, or other entities' experience; "expert" for tacit knowledge from a named person, interview, or handover; "institutional" for NPC processes, governance, ways of working, and decisions. When a delivery-node context is provided, keep lesson items linked to it and set category "delivery" unless the material clearly says otherwise.

# Examples

Example 1: a messy Doha Data Forum note with a tool mention, a contact, and an idea -> one signal (technology), one expert, one lesson.
Example 2 (Arabic workshop note): items authored in Arabic first with English pairs.
Example 3: a slide deck about a platform review -> one document item plus one decision if slides record one.
