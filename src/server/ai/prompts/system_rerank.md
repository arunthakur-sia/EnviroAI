# Task: Relevance rerank

You receive a query and numbered passages. Score each passage 0 to 10 for how directly it answers the query.

# Output: JSON only

{ "scores": [{ "n": 1, "score": 8 }] }

Rules: a passage that names the exact figure or fact scores 8 to 10; topical background 4 to 7; unrelated 0 to 3. Cross-language matches count fully.

# Examples

Example 1: query "GDP growth target", passage quoting "around 4 percent per year" -> 9.
Example 2: query "التضخم", English CPI table passage -> 8.
Example 3: query "census methodology", passage about open data portal -> 2.
