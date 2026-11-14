# Chatty AI — Chatty Core

Chatty Core is an independent, code-based reasoning project. Its chat route does not call OpenAI, Gemini, or another hosted language model. It uses its own TypeScript procedures, conversational rules, a small local knowledge corpus, and a separately hosted Supabase PostgreSQL knowledge store.

## Architecture

```text
Browser chat interface
  └─ Vercel Next.js application
      └─ POST /api/chat
          └─ Chatty Core
              ├─ Mathematics parser and linear equation solver
              ├─ Conversation-intent matcher
              ├─ Built-in local knowledge retrieval
              └─ Supabase PostgreSQL full-text search
                  ├─ Knowledge records and source references
                  ├─ Categories and searchable chunks
                  ├─ Reviewed training examples
                  └─ Import-job tracking
```

GitHub stores the software, SQL migrations, starter corpus and import scripts. Supabase stores searchable records. Vercel runs the application and makes read-only search requests to Supabase.

## Current built-in capabilities

- Arithmetic with brackets, decimals, powers, division and square roots.
- Linear equations in one variable, x.
- A local starter corpus covering computing, chemistry, biology, mathematics and general science.
- Conversation intents and high-confidence phrase matching.
- Recent conversation context for simple follow-ups.
- Honest fallback when no matching information or reasoning rule is available.

The built-in corpus contains 38 knowledge entries, 18 conversation intents and 77 conversation examples. The first database seed contains the same 38 knowledge entries across 5 categories.

## Supabase knowledge store

The prototype uses Supabase PostgreSQL and built-in full-text search. The database contains:

- `knowledge_records`: sourced facts, explanations, aliases, keywords, tags and review status.
- `knowledge_sources`: source URL, publisher, licence and attribution metadata.
- `knowledge_categories` and `knowledge_record_categories`: topic organisation.
- `knowledge_chunks`: smaller searchable sections for later expansion.
- `training_examples`: curated prompt/expected-answer pairs; these are evaluation or retrieval data, not neural-network training.
- `ingestion_jobs`: import progress and error tracking.

Row Level Security is enabled on every table. The public API can read only starter/reviewed knowledge records and call the read-only search function. Source administration, import jobs and training examples remain private. The bulk importer requires a server-only service-role key.

### Configure the application

Copy `.env.example` to `.env.local` and set:

- `SUPABASE_URL`: the Chatty Core Supabase project URL.
- `SUPABASE_PUBLISHABLE_KEY`: the project's publishable API key for read-only search.

The application only needs these two values for ordinary chat. Add them to the Vercel project for Preview and Production. They are not service-role credentials.

### Verify the database

With Node.js 22 or later:

```bash
npm install
npm run db:verify
```

The check confirms that the REST API and `search_knowledge` RPC are reachable.

### Import additional records

For a trusted bulk import, also set `SUPABASE_SERVICE_ROLE_KEY` in your local `.env.local`. Never add this secret to browser code, GitHub source files or a `NEXT_PUBLIC_*` variable.

Prepare a UTF-8 JSON Lines file (`.jsonl`) with one record per line. The schema is in `data/knowledge-import.schema.json`. Each record needs a stable ID, title, domain, keywords, explanation and HTTPS source.

```bash
npm run knowledge:import -- ./path/to/knowledge-records.jsonl
```

The importer streams the file, writes in batches, retries temporary errors, saves a checkpoint and records the outcome in `ingestion_jobs`. New records are marked `starter`; a person must review a record before it can be marked `reviewed`. A source URL does not by itself prove that a statement is correct.

Use datasets whose licences permit this use, preserve attribution, remove duplicates and check factual quality. Do not import private conversations or personal data as training material.

### Measure retrieval accuracy

```bash
npm run knowledge:benchmark
```

The benchmark reports top-1 accuracy and top-5 recall on the included search cases. The target is 90% top-1 accuracy. Passing this benchmark measures retrieval of expected records; it does not prove that every generated explanation is factually correct.

## Capacity and limitations

This Supabase Free project is a prototype, not a billion-record production database. Its quotas are finite. Measure record size, indexing time, search latency and accuracy as the corpus grows. The one-billion-record goal has not been achieved, and a free prototype cannot be assumed to support it.

Do not put a huge dataset in Git or load it into a Vercel Function. Large-scale growth would require a separately budgeted storage and search architecture, data-quality pipelines, deduplication, source/licence tracking, partitioning or sharding, backups and capacity testing.

Chatty Core is still a deterministic rules-and-retrieval system, not a general-purpose neural language model. It does not automatically learn from chat messages. Adding database records improves retrieval coverage; it does not automatically create new reasoning abilities.
