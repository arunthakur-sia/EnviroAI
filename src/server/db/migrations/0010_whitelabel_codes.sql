-- White-label follow-up: internal strategy codes lose their old national-strategy names.
-- Idempotent UPDATEs for existing databases; fresh seeds already write the new codes.
UPDATE `strategy_editions` SET `code` = 'nes' || substr(`code`, 4) WHERE `code` LIKE 'nds_' ;
--> statement-breakpoint
UPDATE `node_leads` SET `node_kind` = 'nes' WHERE `node_kind` = 'nds';
--> statement-breakpoint
UPDATE `node_stakeholders` SET `node_kind` = 'nes' WHERE `node_kind` = 'nds';
--> statement-breakpoint
UPDATE `signal_links` SET `node_kind` = 'nes' WHERE `node_kind` = 'nds';
--> statement-breakpoint
UPDATE `lesson_node_links` SET `node_kind` = 'nes' WHERE `node_kind` = 'nds';
--> statement-breakpoint
UPDATE `report_types` SET `code` = 'nes3' || substr(`code`, 5) WHERE `code` LIKE 'nds3\_%' ESCAPE '\';
--> statement-breakpoint
UPDATE `report_types` SET `default_sections_json` = replace(`default_sections_json`, 'nds3_outcomes_overview', 'nes3_outcomes_overview'),
  `optional_sections_json` = replace(`optional_sections_json`, 'nds3_outcomes_overview', 'nes3_outcomes_overview');
--> statement-breakpoint
UPDATE `report_sections` SET `section_code` = 'nes3_outcomes_overview' WHERE `section_code` = 'nds3_outcomes_overview';
--> statement-breakpoint
UPDATE `calendar_events` SET `kind` = 'nes_review' WHERE `kind` = 'nds_review';
--> statement-breakpoint
UPDATE `settings` SET `key` = 'vision_pillars' WHERE `key` = 'qnv_pillars';
