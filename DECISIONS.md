# DECISIONS

White-label decisions for EnviroAI by Sia. Earlier build history lives in git on `main`.

1. **Vocabulary.** The host organisation is "the Programme Office" (AR مكتب البرنامج). Saudi Arabia, Saudi and the Kingdom replace the previous country wording. The national strategy is the National Environment Strategy (NES); Saudi Vision 2030 is the national vision. "Outcomes" are shown to users as "themes" (AR محور). The product is EnviroAI in both languages, and the assistant is Ask EnviroAI.
2. **Identifier renames.** The home-country property is `home` (`homeYears`, `no_home`, `homeNumber`, `HomeNumbers`, i18n `homeNumbers` and `homeVsGcc`) and its country code is SAU. Origin, scope and user type values for the host organisation became `org` and `org_employee`; `focalOrg*` and column `focal_org_user_id` replace the old focal fields; report type is `org_annual_report`. Demo email domain is `enviroai.demo`; currency is SAR.
3. **Legacy-data tolerance.** Existing databases keep old values. One new migration updates the old rows, and read paths tolerate legacy values until it has run. Existing migration files are never edited.
4. **Internal names kept.** Routes, portals and namespaces called `council` and `council-strategy` stay, because renaming them is high risk. Only user-visible text changes (Programme Strategy, AR استراتيجية المكتب).
5. **Colour keys.** Stored keys are `navy`, `teal`, `aqua` (was maroon, gulf, gold) and neutrals are `mist` (was sand). `src/lib/colour-keys.ts` maps legacy values at read time. Leaderboard medals keep gold.
6. **Typeface.** Sora replaces the previous display and body fonts. Arabic keeps IBM Plex Sans Arabic and Noto Kufi Arabic.
7. **Logos.** Sia logos in `public/brand/`. Reports use the Sia logo and the ascent-line pattern.
8. **Source Library.** Built from the KSA Environmental Data Source Databank. It catalogues public sources with their publishers and links; it does not mirror their data. Anything not verifiable is marked Illustrative.
9. **Integrity.** No fabricated citations, laws, decree numbers, dates or statistics. Real public institutions appear only as external entities; staff and demo users are fictional.
10. **Documentation.** Engagement-specific history documents (blueprint, change requests, design reviews, QC logs, progress log) were removed. They remain in git history on `main`. The Railway runbooks were renamed `ENVIROAI_RAILWAY_*.md`. The data bundle file name `enviroai-data.tar.gz` replaces the previous bundle name in the boot, export and restore scripts.
