# Local Development Guide

## Prerequisites

- **Node.js** 18 or later
- **npm** 9 or later
- A configured Supabase project (see [Supabase Setup Guide](SUPABASE_SETUP.md))
- A Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run database migration

Follow [SUPABASE_SETUP.md](SUPABASE_SETUP.md) to apply the schema.

### 4. Start the dev server

```bash
npm run dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Development Workflow

### Typical user flow to test

1. **Sign up** at `/login` with email and password
2. **Upload samples** at `/upload` — paste text or upload a PDF/TXT file
3. Wait for document status to show **completed** (embeddings are generated automatically)
4. **Create voice profile** at `/voice-profile`
5. **Generate content** at `/generate` — pick a topic and output type
6. **Evaluate** at `/evaluations` — score voice consistency

### Available scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | TypeScript type checking |

## API Testing

With the dev server running and an authenticated session:

```bash
# List documents
curl http://localhost:3000/api/documents \
  -H "Cookie: <your-session-cookie>"

# Create voice profile
curl -X POST http://localhost:3000/api/voice-profile \
  -H "Cookie: <your-session-cookie>"

# Generate content
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: <your-session-cookie>" \
  -d '{"topic": "Leadership lessons from failure", "outputType": "linkedin_post"}'
```

## Architecture Notes

### Server Actions vs API Routes

The app uses both:
- **Server Actions** (`src/actions/`) — used by UI components for form submissions
- **API Routes** (`src/app/api/`) — REST endpoints for programmatic access

### Text Processing Pipeline

1. Upload → extract text (PDF via `pdf-parse`, TXT directly)
2. Chunk text into ~500-token segments with overlap
3. Generate embeddings via Gemini `gemini-embedding-001` (768 dimensions)
4. Store chunks and embeddings in Supabase

### Content Generation (RAG)

1. Embed the user's topic query
2. Vector search via `match_chunks()` RPC
3. Build prompt with voice profile + retrieved examples
4. Generate with Gemini `gemini-2.5-flash` (override via `GEMINI_GENERATION_MODEL`)

## Common Issues

### Build fails with pdf-parse errors
`pdf-parse` is listed in `serverExternalPackages` in `next.config.ts`. Ensure you are on Node.js 18+.

### "GEMINI_API_KEY is not configured"
Add the key to `.env.local` and restart the dev server.

### Middleware redirect loop
Clear cookies and sign in again. Ensure Supabase URL configuration matches `http://localhost:3000`.

### Slow first generation
Gemini API cold starts and embedding generation for large documents can take 10–30 seconds. This is expected.
