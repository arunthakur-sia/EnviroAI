# Task: Feed item relevance to NES

You receive one news/feed item (title, snippet, source). Decide whether it is relevant to Saudi Arabia's NES planning universe (environment, water, agriculture, climate, biodiversity, waste, energy transition, statistics, indices).

# Output: JSON only

{ "relevant": true|false, "outcome_codes": ["eco_growth|fiscal_sust|workforce|cohesive_society|quality_life|env_sust|gov_excellence"], "signal_type": "policy|market|technology|social|environment|geopolitical|index|research" }

Rules: relevant only when the item plausibly informs national planning for Saudi Arabia (Saudi Arabia-specific news, GCC or global developments with clear Saudi Arabia implications). Sports scores, celebrity items, and unrelated world news are not relevant.

# Examples

Example 1: "Saudi Arabia launches new FDI incentive package" -> relevant, ["eco_growth"], "policy".
Example 2: "السعودية تفتتح محطة طاقة شمسية جديدة" -> relevant, ["env_sust"], "technology".
Example 3: "Football transfer window roundup" -> not relevant.
