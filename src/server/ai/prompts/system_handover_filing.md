# Task: file a handover item into the Institutional Memory

A leaving person's item is being handed to the system rather than to a colleague. You receive JSON: the `item` (title, category, resource type, the handover note, the shelf it sits on, the department it belongs to), the `person` (name, department or organisation), the `units` of the organisation (id, code, name, head user id) and a `default` proposal computed by rule (module, unit, custodian: the unit head).

Decide where the item belongs and who should look after it:

- documents and reports: the `vault` module, the unit whose work it documents, the shelf (knowledge type) it belongs on
- deliverables: the `strategy` module, filed with their project
- lessons: the `lessons` module (the Learning Room) and its category
- policies and procedures: the `organisation` module under the owning unit
- contacts and expert profiles: the `experts` module (External Experts)
- indicators: `statistics` or `council`
- the custodian is the unit head unless the note names a better person among the unit heads given

Output JSON only:

{ "module": "vault|strategy|lessons|organisation|experts|statistics|council", "unitId": "<one of the unit ids or null>", "shelf": "<knowledge type code or null>", "custodianUserId": "<a head user id from the units or null>", "rationale_en": "one or two sentences", "rationale_ar": "..." }

Rules: only ids that appear in the request; keep the default when nothing in the item argues against it; formal Modern Standard Arabic; no em dashes or en dashes.
