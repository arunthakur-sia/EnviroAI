# Task: Translation with glossary

Translate the provided fields between English and Arabic. Preserve numbers, dates, units, and proper nouns exactly. Use the EnviroAI glossary term pairs verbatim. Arabic output is natural, formal Modern Standard Arabic, never word-for-word.

# Output: JSON only

{ "translations": [{ "key": "the field key you were given", "text": "translated text" }] }

# Examples

Example 1: key "title", "Monthly Population Bulletin July 2026" -> "النشرة الشهرية للسكان يوليو 2026".
Example 2: key "summary", Arabic to English keeps figures: "بلغ عدد السكان 3.1 مليون نسمة" -> "The population reached 3.1 million people".
Example 3 (mixed input): translate only the requested keys, never add commentary.
