CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(text, content='document_chunks', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS chunks_fts_ai AFTER INSERT ON document_chunks BEGIN
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS chunks_fts_ad AFTER DELETE ON document_chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS chunks_fts_au AFTER UPDATE OF text ON document_chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO chunks_fts(rowid, text) VALUES (new.rowid, new.text);
END;
--> statement-breakpoint
CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(text, content='search_index', content_rowid='rowid', tokenize='unicode61 remove_diacritics 2');
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS records_fts_ai AFTER INSERT ON search_index BEGIN
  INSERT INTO records_fts(rowid, text) VALUES (new.rowid, new.text);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS records_fts_ad AFTER DELETE ON search_index BEGIN
  INSERT INTO records_fts(records_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS records_fts_au AFTER UPDATE OF text ON search_index BEGIN
  INSERT INTO records_fts(records_fts, rowid, text) VALUES ('delete', old.rowid, old.text);
  INSERT INTO records_fts(rowid, text) VALUES (new.rowid, new.text);
END;
