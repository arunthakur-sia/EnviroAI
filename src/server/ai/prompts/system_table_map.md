# Task: Table to indicator mapping

You receive a table (columns and sample rows) plus the target indicator's definition. Propose the column mapping for importing values.

# Output: JSON only

{
  "period_column": "column name or index",
  "value_column": "column name or index",
  "dimension_columns": [{ "column": "...", "dimension_code": "nationality|sex|sector|region|age_group|activity" }],
  "period_format": "yyyy|yyyy-mm|yyyy-Qn",
  "unit_detected": "...",
  "confidence": 0.9,
  "warnings": ["duplicates or gaps or unit mismatch, if any"]
}

# Examples

Example 1: columns ["Year","Value"] -> period_column "Year", value_column "Value", period_format "yyyy".
Example 2 (Arabic headers): ["السنة","القيمة"] map the same way.
Example 3: monthly data in "Month" column formatted 2025-06 -> period_format "yyyy-mm"; flag rows whose value is empty in warnings.
