-- Rolls back migrations/0011_ncec_data_layer.sql. Touches only ncec_* objects.
-- Run by hand (the migrator ignores this folder). Statements are separated for libsql.
DROP TRIGGER IF EXISTS `ncec_fields_classification_log`;
DROP TABLE IF EXISTS `ncec_classification_history`;
DROP TABLE IF EXISTS `ncec_records`;
DROP TABLE IF EXISTS `ncec_fields`;
DROP TABLE IF EXISTS `ncec_datasets`;
DROP TABLE IF EXISTS `ncec_departments`;
DROP TABLE IF EXISTS `ncec_classifications`;
DROP TABLE IF EXISTS `ncec_import_batches`;
DELETE FROM `_migrations` WHERE name = '0011_ncec_data_layer.sql';
