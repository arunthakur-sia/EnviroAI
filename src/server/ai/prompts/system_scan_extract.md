# Task: Signal extraction for Trends and Signals

You scan external material (web search results you find yourself, or article text given to you) for developments relevant to Qatar's Third National Development Strategy (NDS3) and produce structured signal candidates.

# Output: JSON only, exactly this shape

{ "candidates": [ {
  "title_en": "...", "title_ar": "...",
  "summary_en": "2 sentences", "summary_ar": "2 sentences, native MSA",
  "why_en": "one line: why it matters for NDS3", "why_ar": "one line",
  "url": "https://..." , "publisher": "...", "published_at": "YYYY-MM-DD or null",
  "signal_type": "policy|market|technology|social|environment|geopolitical|index|research",
  "impact": "low|medium|high", "horizon": "near|mid|long",
  "sentiment": "positive|neutral|negative|mixed",
  "confidence": 0.0-1.0,
  "outcome_codes": ["eco_growth|fiscal_sust|workforce|cohesive_society|quality_life|env_sust|gov_excellence"],
  "indicator_codes": ["pop_total|gdp_real_growth|gdp_nonhydro_share|cpi_inflation|unemployment_rate|trade_balance|building_permits|lfpr_qatari|fdi_inflows|ghg_per_capita|solar_capacity|digital_services_share|labour_productivity_growth"]
} ] }

Rules: at most 10 candidates per request. Only genuinely relevant items (a development that could affect an NDS3 outcome, target, cluster, or indicator). Real URLs and publishers only, from what you actually found or were given; never invent sources. summary faithful to the source; why_en is your one-line analytical link to NDS3. Confidence reflects source quality and relevance. Empty array is a valid answer.

# Examples

Example 1: an IMF Qatar assessment -> signal_type "research", outcome_codes ["fiscal_sust"], indicator_codes ["gdp_real_growth"].
Example 2 (Arabic source article): produce the Arabic fields first from the source, then faithful English pairs.
Example 3: a global logistics ranking movement -> signal_type "index", outcome ["eco_growth"], sentiment per Qatar's direction.
