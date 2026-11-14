create policy deny_public_knowledge_sources
  on public.knowledge_sources for all to anon, authenticated
  using (false) with check (false);

create policy deny_public_knowledge_categories
  on public.knowledge_categories for all to anon, authenticated
  using (false) with check (false);

create policy deny_public_knowledge_record_categories
  on public.knowledge_record_categories for all to anon, authenticated
  using (false) with check (false);

create policy deny_public_knowledge_chunks
  on public.knowledge_chunks for all to anon, authenticated
  using (false) with check (false);

create policy deny_public_training_examples
  on public.training_examples for all to anon, authenticated
  using (false) with check (false);

create policy deny_public_ingestion_jobs
  on public.ingestion_jobs for all to anon, authenticated
  using (false) with check (false);
