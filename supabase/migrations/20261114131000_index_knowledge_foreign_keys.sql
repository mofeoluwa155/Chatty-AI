create index if not exists knowledge_categories_parent_slug_idx
  on public.knowledge_categories (parent_slug)
  where parent_slug is not null;

create index if not exists knowledge_record_categories_category_slug_idx
  on public.knowledge_record_categories (category_slug);

create index if not exists knowledge_records_source_id_idx
  on public.knowledge_records (source_id)
  where source_id is not null;
