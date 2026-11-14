create policy knowledge_records_public_read
on public.knowledge_records
for select
to anon, authenticated
using (review_status in ('starter', 'reviewed'));

grant select (
  id, title, domain, aliases, keywords, explanation, example,
  source_url, tags, language, review_status, search_vector
) on public.knowledge_records to anon, authenticated;

grant execute on function public.search_knowledge(text, integer)
to anon, authenticated;
