grant usage on schema private to service_role;
grant execute on function private.set_updated_at() to service_role;
grant execute on function private.maintain_knowledge_search_vector() to service_role;
grant execute on function private.maintain_chunk_search_vector() to service_role;
