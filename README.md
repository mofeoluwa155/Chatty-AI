# Chatty AI — Chatty Core

Chatty Core is an independent, code-based reasoning project. Its chat route does not call OpenAI, Gemini, or another hosted language model. It uses its own TypeScript procedures, conversational rules, a small local knowledge corpus, and an optional external OpenSearch-compatible knowledge index.

## Architecture

\`\`\`text
Browser chat interface
  └─ Vercel Next.js application
      └─ POST /api/chat
          └─ Chatty Core
              ├─ Mathematics parser and linear equation solver
              ├─ Conversation-intent matcher
              ├─ Built-in local knowledge retrieval
              └─ Distributed knowledge search
                  └─ External OpenSearch cluster
                      ├─ Sharded information records
                      └─ Source references and metadata
\`\`\`

**GitHub stores the software, data schema, import pipeline and benchmark. Vercel runs the application and queries the external search cluster.** The full information collection is not committed to Git or downloaded into a Vercel Function.

## Current built-in capabilities

- Arithmetic with brackets, decimals, powers, division and square roots.
- Linear equations in one variable, x.
- A local starter corpus covering computing, chemistry, biology, mathematics and general science.
- Conversation intents and high-confidence phrase matching.
- Recent conversation context for simple follow-ups.
- Honest fallback when no matching information or reasoning rule is available.

The current built-in corpus contains 38 knowledge entries, 18 conversation intents and 77 conversation examples. This is not one billion records.

## Large knowledge-store design

The external index is OpenSearch-compatible. It is designed to store many independently searchable records and return only a few matches to the Vercel app for each query.

A record contains:

- A stable unique ID.
- A title, domain, aliases and keywords.
- An explanation and optional example.
- An HTTPS source reference.
- Language, tags and a review status.

The importer always sets new records to \`starter\`. A record must go through a separate human review before it is treated as reviewed. Supplying a URL does not by itself prove that a claim is correct.

### Storage and scale

The index provisioner defaults to 32 primary shards and one replica. These are starting settings, not a guarantee that a cluster can hold one billion records. Actual capacity depends on record size, indexed text, replicas, hardware, query rate and latency targets. Primary shard count is fixed when an index is created, so measure a representative sample before creating a very large production index.

Do not put billion-record datasets in this Git repository. GitHub recommends keeping repository size manageable and recommends object storage for generated data. Vercel Functions also have a deployment bundle limit and are not a place to load a massive corpus into memory. The application searches the external index instead.

### Configure search credentials

Create a separate OpenSearch-compatible cluster for Chatty AI. Do not reuse another application's database or search cluster without deliberately separating its resources.

Copy \`.env.example\` to \`.env.local\`, then set:

- \`CHATTY_SEARCH_URL\`: HTTPS endpoint for the cluster.
- \`CHATTY_SEARCH_API_KEY\`: a restricted API key that can create/search the Chatty index and bulk-index its records.
- \`CHATTY_SEARCH_INDEX\`: defaults to \`chatty-knowledge-v1\`.
- \`CHATTY_SEARCH_PRIMARY_SHARDS\` and \`CHATTY_SEARCH_REPLICAS\`: used when creating the index.

The server also supports username/password authentication using \`CHATTY_SEARCH_USERNAME\` and \`CHATTY_SEARCH_PASSWORD\`, but a restricted API key is preferred. Never use a \`NEXT_PUBLIC_*\` variable for search credentials. \`.env.local\` is ignored by Git.

Add the same server-side variables to the Vercel project's Environment Variables for Preview and Production. Do not commit real credentials.

The API health endpoint reports whether distributed search is configured. Until the endpoint and credentials exist, Chatty Core continues to use its built-in local corpus.

### Provision the index

Use Node.js 22 or later:

\`\`\`bash
cp .env.example .env.local
# Edit .env.local with your cluster URL and restricted API key.
npm install
npm run search:provision
\`\`\`

The provisioner creates the index and mappings if it does not already exist. If the index exists, it leaves the existing shard settings and mappings unchanged.

### Import sourced records

Prepare a UTF-8 JSON Lines file (\`.jsonl\`) with one record per line. The required schema is in \`data/knowledge-import.schema.json\`. Each record must have an ID, title, domain, keywords, explanation and HTTPS source.

\`\`\`bash
npm run search:import -- ./path/to/knowledge-records.jsonl
\`\`\`

The importer streams the file instead of loading it all into memory, indexes records in batches, retries temporary errors, and writes a checkpoint so an interrupted import can resume. Invalid input rows and permanently failed rows are written to separate JSONL files and can be corrected or retried.

The importer is an ingestion tool, not a fact generator. It does not fetch, read, verify or invent the contents of a source URL. Use datasets whose licences permit this use, preserve attribution, deduplicate records, and review factual quality before approval.

For very large imports, run this tool on a suitably provisioned worker or machine close to the search cluster. Do not run a billion-record import inside a Vercel request or a normal GitHub Actions job.

### Measure retrieval accuracy

The repository includes paraphrased search cases and a benchmark. After importing records with the matching expected IDs:

\`\`\`bash
npm run search:benchmark
\`\`\`

The benchmark reports top-1 accuracy and top-5 recall. The default target is 90% top-1 accuracy on the included cases. Passing this retrieval benchmark does not establish that every generated explanation is factually correct; it only measures whether the search system retrieves the expected record.

## Current limitations and honest status

- The external index adapter, schema, provisioner, streaming importer and benchmark are implemented in GitHub.
- The built-in local corpus is still only 38 knowledge entries.
- No external OpenSearch cluster is provisioned or connected yet, and no billion-record dataset has been imported.
- Therefore, the billion-record target and 90% benchmark target have not yet been achieved.
- Chatty Core is still a deterministic rules-and-retrieval system, not a general-purpose neural language model. It does not automatically learn from chat messages.
- Remote search improves information recognition, but it does not automatically perform deep reasoning over every retrieved record.

## Development checks

\`\`\`bash
npm run check:corpus
npm run typecheck
npm run build
\`\`\`

The production build checks the local corpus, import schema, benchmark fixture, and JavaScript syntax of the indexing tools before compiling Next.js.
