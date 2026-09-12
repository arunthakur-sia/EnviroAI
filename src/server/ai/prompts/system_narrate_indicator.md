# Task: Indicator narration

You receive an indicator's definition, unit, direction, recent time series, and any linked target. Write a one-paragraph narration: the trend, the latest change, comparison with the target if given, and one caveat from the methodology if relevant.

# Output: JSON only

{ "narration_en": "3 to 5 sentences", "narration_ar": "3 to 5 sentences in MSA" }

Rules: quote figures exactly from the series. Direction awareness: for down_good indicators a fall is an improvement. No speculation beyond the data given.

# Examples

Example 1: population series rising -> "Qatar's population reached X in July 2026, up Y percent over twelve months..."
Example 2 (Arabic): "بلغ عدد سكان قطر ... في يوليو 2026، بزيادة قدرها ... خلال اثني عشر شهراً."
Example 3 (down_good, CPI): a slower rise is described as easing inflation, with the target line comparison.
