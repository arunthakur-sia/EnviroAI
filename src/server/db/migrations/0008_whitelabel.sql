-- EnviroAI white-label: converts rows written by the earlier brand to the
-- current vocabulary. Data only, plus one column rename and insert triggers
-- that keep an older column DEFAULT from writing a legacy value.
--   source_origin  'npc'          -> 'org'
--   experts.type   'npc_employee' -> 'org_employee'
--   report_types.scope_kind 'npc' -> 'org'; code 'npc_annual_report' -> 'org_annual_report'
--   reports.scope_json kind "npc" -> "org"
--   entity_interfaces.focal_npc_user_id -> focal_org_user_id
--   colour keys maroon/gulf/gold/sand -> navy/teal/aqua/mist
--   settings allowed_domains and user/expert e-mail domain npc.qa -> enviroai.demo
-- Safe to rerun: every UPDATE is a no-op once converted.

UPDATE `documents` SET `source_origin` = 'org' WHERE `source_origin` = 'npc';
--> statement-breakpoint

UPDATE `experts` SET `type` = 'org_employee' WHERE `type` = 'npc_employee';
--> statement-breakpoint

UPDATE `report_types` SET `scope_kind` = 'org' WHERE `scope_kind` = 'npc';
--> statement-breakpoint

UPDATE `report_types` SET `code` = 'org_annual_report' WHERE `code` = 'npc_annual_report';
--> statement-breakpoint

UPDATE `reports` SET `scope_json` = replace(`scope_json`, '"kind":"npc"', '"kind":"org"') WHERE `scope_json` LIKE '%"kind":"npc"%';
--> statement-breakpoint

UPDATE `reports` SET `scope_json` = replace(`scope_json`, '"kind": "npc"', '"kind": "org"') WHERE `scope_json` LIKE '%"kind": "npc"%';
--> statement-breakpoint

-- idempotent: the rename runs once; on a rerun the column already has the new name
ALTER TABLE `entity_interfaces` RENAME COLUMN `focal_npc_user_id` TO `focal_org_user_id`;
--> statement-breakpoint

UPDATE `users` SET `avatar_color` = 'navy' WHERE `avatar_color` = 'maroon';
--> statement-breakpoint

UPDATE `users` SET `avatar_color` = 'teal' WHERE `avatar_color` = 'gulf';
--> statement-breakpoint

UPDATE `users` SET `avatar_color` = 'aqua' WHERE `avatar_color` = 'gold';
--> statement-breakpoint

UPDATE `users` SET `avatar_color` = 'mist' WHERE `avatar_color` = 'sand';
--> statement-breakpoint

UPDATE `experts` SET `avatar_color` = 'navy' WHERE `avatar_color` = 'maroon';
--> statement-breakpoint

UPDATE `experts` SET `avatar_color` = 'teal' WHERE `avatar_color` = 'gulf';
--> statement-breakpoint

UPDATE `experts` SET `avatar_color` = 'aqua' WHERE `avatar_color` = 'gold';
--> statement-breakpoint

UPDATE `experts` SET `avatar_color` = 'mist' WHERE `avatar_color` = 'sand';
--> statement-breakpoint

UPDATE `index_groups` SET `colour_token` = 'navy' WHERE `colour_token` = 'maroon';
--> statement-breakpoint

UPDATE `index_groups` SET `colour_token` = 'teal' WHERE `colour_token` = 'gulf';
--> statement-breakpoint

UPDATE `index_groups` SET `colour_token` = 'aqua' WHERE `colour_token` = 'gold';
--> statement-breakpoint

UPDATE `index_groups` SET `colour_token` = 'mist' WHERE `colour_token` = 'sand';
--> statement-breakpoint

UPDATE `collections` SET `cover_style` = replace(`cover_style`, 'maroon-', 'navy-') WHERE `cover_style` LIKE 'maroon-%';
--> statement-breakpoint

UPDATE `collections` SET `cover_style` = replace(`cover_style`, 'gulf-', 'teal-') WHERE `cover_style` LIKE 'gulf-%';
--> statement-breakpoint

UPDATE `collections` SET `cover_style` = replace(`cover_style`, 'gold-', 'aqua-') WHERE `cover_style` LIKE 'gold-%';
--> statement-breakpoint

UPDATE `collections` SET `cover_style` = replace(`cover_style`, 'sand-', 'mist-') WHERE `cover_style` LIKE 'sand-%';
--> statement-breakpoint

UPDATE `communities` SET `cover_style` = replace(`cover_style`, 'maroon-', 'navy-') WHERE `cover_style` LIKE 'maroon-%';
--> statement-breakpoint

UPDATE `communities` SET `cover_style` = replace(`cover_style`, 'gulf-', 'teal-') WHERE `cover_style` LIKE 'gulf-%';
--> statement-breakpoint

UPDATE `communities` SET `cover_style` = replace(`cover_style`, 'gold-', 'aqua-') WHERE `cover_style` LIKE 'gold-%';
--> statement-breakpoint

UPDATE `communities` SET `cover_style` = replace(`cover_style`, 'sand-', 'mist-') WHERE `cover_style` LIKE 'sand-%';
--> statement-breakpoint

UPDATE `settings` SET `value_json` = replace(`value_json`, 'npc.qa', 'enviroai.demo') WHERE `key` = 'allowed_domains' AND `value_json` LIKE '%npc.qa%';
--> statement-breakpoint

UPDATE `users` SET `email` = replace(`email`, '@enviroai.demo', '@enviroai.demo') WHERE `email` LIKE '%@enviroai.demo';
--> statement-breakpoint

UPDATE `experts` SET `email` = replace(`email`, '@enviroai.demo', '@enviroai.demo') WHERE `email` LIKE '%@enviroai.demo';
--> statement-breakpoint

-- Insert triggers: the column DEFAULTs of tables created by earlier migrations
-- cannot be altered in SQLite, so a row inserted without the column is corrected.

CREATE TRIGGER IF NOT EXISTS `wl_documents_source_origin` AFTER INSERT ON `documents` WHEN NEW.`source_origin` = 'npc' BEGIN UPDATE `documents` SET `source_origin` = 'org' WHERE `id` = NEW.`id`; END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `wl_experts_type` AFTER INSERT ON `experts` WHEN NEW.`type` = 'npc_employee' BEGIN UPDATE `experts` SET `type` = 'org_employee' WHERE `id` = NEW.`id`; END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `wl_report_types_scope_kind` AFTER INSERT ON `report_types` WHEN NEW.`scope_kind` = 'npc' BEGIN UPDATE `report_types` SET `scope_kind` = 'org' WHERE `id` = NEW.`id`; END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `wl_users_avatar_color` AFTER INSERT ON `users` WHEN NEW.`avatar_color` = 'maroon' BEGIN UPDATE `users` SET `avatar_color` = 'navy' WHERE `id` = NEW.`id`; END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `wl_experts_avatar_color` AFTER INSERT ON `experts` WHEN NEW.`avatar_color` = 'gulf' BEGIN UPDATE `experts` SET `avatar_color` = 'teal' WHERE `id` = NEW.`id`; END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `wl_index_groups_colour_token` AFTER INSERT ON `index_groups` WHEN NEW.`colour_token` = 'maroon' BEGIN UPDATE `index_groups` SET `colour_token` = 'navy' WHERE `id` = NEW.`id`; END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `wl_collections_cover_style` AFTER INSERT ON `collections` WHEN NEW.`cover_style` = 'maroon-weave' BEGIN UPDATE `collections` SET `cover_style` = 'navy-weave' WHERE `id` = NEW.`id`; END;
--> statement-breakpoint

CREATE TRIGGER IF NOT EXISTS `wl_communities_cover_style` AFTER INSERT ON `communities` WHEN NEW.`cover_style` = 'gulf-weave' BEGIN UPDATE `communities` SET `cover_style` = 'teal-weave' WHERE `id` = NEW.`id`; END;
