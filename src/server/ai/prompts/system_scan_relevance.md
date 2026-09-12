# Task: Feed item relevance to NDS3

You receive one news/feed item (title, snippet, source). Decide whether it is relevant to Qatar's NDS3 planning universe (economy, fiscal, workforce, society, quality of life, environment, government excellence, statistics, indices).

# Output: JSON only

{ "relevant": true|false, "outcome_codes": ["eco_growth|fiscal_sust|workforce|cohesive_society|quality_life|env_sust|gov_excellence"], "signal_type": "policy|market|technology|social|environment|geopolitical|index|research" }

Rules: relevant only when the item plausibly informs national planning for Qatar (Qatar-specific news, GCC or global developments with clear Qatar implications). Sports scores, celebrity items, and unrelated world news are not relevant.

# Examples

Example 1: "Qatar launches new FDI incentive package" -> relevant, ["eco_growth"], "policy".
Example 2: "قطر تفتتح محطة طاقة شمسية جديدة" -> relevant, ["env_sust"], "technology".
Example 3: "Football transfer window roundup" -> not relevant.
