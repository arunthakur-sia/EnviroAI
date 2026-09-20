# Query plans (generated)

Generated 2026-09-20T00:04:44.393Z by `node scripts/qc/query-plans.mjs` over `data/nexus.db`.
A finding is a full scan of a table large enough for it to matter; a scan of a small
reference table (levels, roles, taxonomy) is cheaper than the index lookup and is not flagged.

30 queries checked, 0 with a scan of a large table.

| query | plan | finding |
| --- | --- | --- |
| documents: the library listing | SCAN documents USING INDEX documents_created_idx | ok |
| documents: by knowledge type (studies) | SEARCH documents USING INDEX documents_type_idx (knowledge_type_term_id=?)<br>USE TEMP B-TREE FOR ORDER BY | ok |
| document chunks of one document | SEARCH document_chunks USING INDEX chunks_document_idx (document_id=?)<br>USE TEMP B-TREE FOR ORDER BY | ok |
| search index by resource | SEARCH search_index USING INDEX search_index_unique (resource_type=? AND resource_id=?) | ok |
| index observations of one index | SEARCH index_observations USING INDEX index_obs_index_idx (index_id=?)<br>USE TEMP B-TREE FOR ORDER BY | ok |
| index observations for a year | SEARCH index_observations USING INDEX index_obs_year_idx (year=?) | ok |
| indicator values of one indicator | SEARCH indicator_values USING INDEX indicator_values_unique (indicator_id=?) | ok |
| council values in a period | SEARCH council_indicator_values USING INDEX council_values_period_idx (period=?) | ok |
| game events of one person | SEARCH game_events USING INDEX game_events_user_idx (user_id=?) | ok |
| leaderboard rows for a board | SEARCH leaderboard_periods USING INDEX leaderboard_periods_lookup (board=? AND category=? AND period_kind=? AND period_key=?) | ok |
| notifications: unread badge | SEARCH notifications USING COVERING INDEX notifications_user_read_idx (user_id=? AND read_at=?) | ok |
| inbox: unread threads | SEARCH p USING INDEX thread_participants_user_idx (user_id=?)<br>SEARCH t USING INDEX sqlite_autoindex_message_threads_1 (id=?) | ok |
| messages of one thread | SEARCH messages USING INDEX messages_thread_idx (thread_id=?) | ok |
| strategy nodes of an edition | SEARCH strategy_nodes USING INDEX nodes_edition_idx (edition_id=?) | ok |
| lessons by status | SEARCH lessons USING INDEX lessons_status_idx (status=?)<br>USE TEMP B-TREE FOR ORDER BY | ok |
| lesson links of a node | SEARCH lesson_node_links USING INDEX lesson_links_node_idx (node_id=?) | ok |
| handover items of one handover | SEARCH handover_items USING INDEX handover_items_h_idx (handover_id=?) | ok |
| report sections of one report | SEARCH report_sections USING INDEX report_sections_report_idx (report_id=?)<br>USE TEMP B-TREE FOR ORDER BY | ok |
| reports by status | SEARCH reports USING INDEX reports_status_idx (status=?)<br>USE TEMP B-TREE FOR ORDER BY | ok |
| processes by parent | SEARCH processes USING INDEX processes_parent_idx (parent_id=?)<br>USE TEMP B-TREE FOR ORDER BY | ok |
| raci of one process | SEARCH process_raci USING INDEX process_raci_unique (process_id=?) | ok |
| interfaces of one unit | MULTI-INDEX OR<br>INDEX 1<br>SEARCH unit_interfaces USING INDEX unit_interfaces_from_idx (from_unit_id=?)<br>INDEX 2<br>SEARCH unit_interfaces USING INDEX unit_interfaces_to_idx (to_unit_id=?) | ok |
| calendar of a year | SEARCH calendar_events USING INDEX calendar_events_date_idx (date_from>? AND date_from<?) | ok |
| knowledge of the week: active | SCAN knowledge_of_week | ok |
| kow reads of one pick | SEARCH knowledge_of_week_reads USING COVERING INDEX kow_reads_unique (kow_id=?) | ok |
| org units by parent | SEARCH org_units USING INDEX org_units_parent_idx (parent_id=?) | ok |
| people of one unit | SCAN users | ok |
| node stakeholders of a node | SEARCH node_stakeholders USING INDEX node_stakeholders_node_idx (node_id=?) | ok |
| audit trail of one resource | SEARCH audit_log USING INDEX audit_resource_idx (resource_type=? AND resource_id=?) | ok |
| jobs the worker claims | SEARCH jobs USING INDEX jobs_status_idx (status=?)<br>USE TEMP B-TREE FOR ORDER BY | ok |
