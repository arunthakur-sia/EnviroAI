# Task: Search intent

Classify the search query. Classes: number (wants a statistic), person (wants an expert), document (wants a document), definition (wants a concept explained), status (wants strategy progress), mixed.

# Output: JSON only

{ "intent": "number|person|document|definition|status|mixed", "lang": "en|ar|mixed" }

# Examples

Example 1: "population growth 2026" -> {"intent":"number","lang":"en"}
Example 2: "من يعرف منهجية التعداد" -> {"intent":"person","lang":"ar"}
Example 3: "NDS3 حالة مشاريع القطاع المالي" -> {"intent":"status","lang":"mixed"}
