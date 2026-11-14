create schema if not exists private;

create table public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  url text not null unique check (url ~ '^https://'),
  publisher text,
  licence text,
  attribution text,
  retrieved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.knowledge_categories (
  slug text primary key check (slug ~ '^[a-z0-9][a-z0-9_-]{0,79}$'),
  name text not null,
  description text,
  parent_slug text references public.knowledge_categories(slug) on delete set null,
  created_at timestamptz not null default now()
);

create table public.knowledge_records (
  id text primary key check (length(btrim(id)) between 1 and 512),
  title text not null check (length(btrim(title)) between 1 and 500),
  domain text not null check (length(btrim(domain)) between 1 and 120),
  aliases text[] not null default '{}',
  keywords text[] not null default '{}',
  explanation text not null check (length(btrim(explanation)) between 1 and 20000),
  example text check (example is null or length(example) <= 5000),
  source_url text check (source_url is null or source_url ~ '^https://'),
  source_id uuid references public.knowledge_sources(id) on delete set null,
  licence text,
  attribution text,
  tags text[] not null default '{}',
  language text not null default 'en',
  review_status text not null default 'starter'
    check (review_status in ('starter', 'reviewed', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  search_vector pg_catalog.tsvector not null default ''::pg_catalog.tsvector,
  constraint reviewed_records_need_source
    check (review_status <> 'reviewed' or source_url is not null or source_id is not null)
);

create index knowledge_records_search_idx
  on public.knowledge_records using gin (search_vector);
create index knowledge_records_domain_status_idx
  on public.knowledge_records (domain, review_status);
create index knowledge_records_tags_idx
  on public.knowledge_records using gin (tags);

create table public.knowledge_record_categories (
  knowledge_id text not null references public.knowledge_records(id) on delete cascade,
  category_slug text not null references public.knowledge_categories(slug) on delete cascade,
  primary key (knowledge_id, category_slug)
);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  knowledge_id text not null references public.knowledge_records(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (length(btrim(content)) between 1 and 12000),
  created_at timestamptz not null default now(),
  search_vector pg_catalog.tsvector not null default ''::pg_catalog.tsvector,
  unique (knowledge_id, chunk_index)
);
create index knowledge_chunks_search_idx
  on public.knowledge_chunks using gin (search_vector);

create table public.training_examples (
  id uuid primary key default gen_random_uuid(),
  prompt text not null check (length(btrim(prompt)) between 1 and 12000),
  expected_answer text not null check (length(btrim(expected_answer)) between 1 and 20000),
  intent text,
  source_url text check (source_url is null or source_url ~ '^https://'),
  licence text,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'reviewed', 'rejected')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index training_examples_intent_status_idx
  on public.training_examples (intent, review_status);

create table public.ingestion_jobs (
  id uuid primary key default gen_random_uuid(),
  dataset_name text not null,
  dataset_version text,
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed', 'cancelled')),
  records_seen bigint not null default 0 check (records_seen >= 0),
  records_inserted bigint not null default 0 check (records_inserted >= 0),
  records_rejected bigint not null default 0 check (records_rejected >= 0),
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function private.maintain_knowledge_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(new.title, '')), 'A') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(pg_catalog.array_to_string(new.aliases, ' '), '')), 'B') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(pg_catalog.array_to_string(new.keywords, ' '), '')), 'B') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(new.domain, '')), 'C') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(new.explanation, '')), 'D') ||
    pg_catalog.setweight(pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(new.example, '')), 'D');
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

create or replace function private.maintain_chunk_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector := pg_catalog.to_tsvector('english'::pg_catalog.regconfig, coalesce(new.content, ''));
  return new;
end;
$$;

create trigger knowledge_records_search_vector
before insert or update on public.knowledge_records
for each row execute function private.maintain_knowledge_search_vector();

create trigger knowledge_records_set_updated_at
before update on public.knowledge_records
for each row execute function private.set_updated_at();

create trigger knowledge_chunks_search_vector
before insert or update on public.knowledge_chunks
for each row execute function private.maintain_chunk_search_vector();

create trigger training_examples_set_updated_at
before update on public.training_examples
for each row execute function private.set_updated_at();

create trigger ingestion_jobs_set_updated_at
before update on public.ingestion_jobs
for each row execute function private.set_updated_at();

create or replace function public.search_knowledge(
  query_text text,
  result_limit integer default 3
)
returns table (
  id text,
  title text,
  aliases text[],
  keywords text[],
  explanation text,
  example text,
  source text,
  domain text,
  tags text[],
  language text,
  review_status text,
  relevance real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with parsed_query as (
    select pg_catalog.websearch_to_tsquery('english'::pg_catalog.regconfig, coalesce(query_text, '')) as tsq
  )
  select
    record.id,
    record.title,
    record.aliases,
    record.keywords,
    record.explanation,
    record.example,
    record.source_url as source,
    record.domain,
    record.tags,
    record.language,
    record.review_status,
    pg_catalog.ts_rank_cd(record.search_vector, parsed_query.tsq)::real as relevance
  from public.knowledge_records as record
  cross join parsed_query
  where record.review_status in ('starter', 'reviewed')
    and parsed_query.tsq <> ''::pg_catalog.tsquery
    and record.search_vector @@ parsed_query.tsq
  order by relevance desc, (record.review_status = 'reviewed') desc, record.id asc
  limit least(greatest(coalesce(result_limit, 3), 1), 10);
$$;

alter table public.knowledge_sources enable row level security;
alter table public.knowledge_categories enable row level security;
alter table public.knowledge_records enable row level security;
alter table public.knowledge_record_categories enable row level security;
alter table public.knowledge_chunks enable row level security;
alter table public.training_examples enable row level security;
alter table public.ingestion_jobs enable row level security;

revoke all on table
  public.knowledge_sources,
  public.knowledge_categories,
  public.knowledge_records,
  public.knowledge_record_categories,
  public.knowledge_chunks,
  public.training_examples,
  public.ingestion_jobs
from anon, authenticated;

grant select, insert, update, delete on table
  public.knowledge_sources,
  public.knowledge_categories,
  public.knowledge_records,
  public.knowledge_record_categories,
  public.knowledge_chunks,
  public.training_examples,
  public.ingestion_jobs
to service_role;

revoke all on function public.search_knowledge(text, integer) from public, anon, authenticated;
grant execute on function public.search_knowledge(text, integer) to service_role;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.maintain_knowledge_search_vector() from public, anon, authenticated;
revoke all on function private.maintain_chunk_search_vector() from public, anon, authenticated;
