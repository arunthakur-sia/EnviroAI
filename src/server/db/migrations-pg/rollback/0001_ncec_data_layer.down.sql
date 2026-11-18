-- Rolls back migrations-pg/0001_ncec_data_layer.sql. Touches only ncec_* objects.
DROP TRIGGER IF EXISTS ncec_fields_classification_log ON ncec_fields;
DROP FUNCTION IF EXISTS ncec_log_classification_change();
DROP TABLE IF EXISTS ncec_classification_history;
DROP TABLE IF EXISTS ncec_records;
DROP TABLE IF EXISTS ncec_fields;
DROP TABLE IF EXISTS ncec_datasets;
DROP TABLE IF EXISTS ncec_departments;
DROP TABLE IF EXISTS ncec_classifications;
DROP TABLE IF EXISTS ncec_import_batches;
DELETE FROM _pg_migrations WHERE name = '0001_ncec_data_layer.sql';
