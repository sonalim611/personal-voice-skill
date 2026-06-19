# Personal Voice Skill

An AI-powered writing assistant that learns your unique writing style from uploaded samples and LinkedIn posts, then generates new content that matches your voice.

## Features

- **Authentication** — Email sign-up and sign-in via Supabase Auth
- **Upload Writing Samples** — PDF, TXT, pasted text, and LinkedIn posts
- **Text Processing** — Automatic extraction, chunking, and embedding with Google Gemini
- **Voice Profile** — AI analysis of tone, structure, vocabulary, and recurring phrases
- **Content Generation** — LinkedIn posts, blog posts, emails, and tweet threads in your style
- **RAG Pipeline** — Vector search retrieves relevant writing examples for each generation
- **Evaluation** — LLM-as-a-Judge scores voice consistency across four dimensions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Database | Supabase (PostgreSQL + pgvector) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
| AI | Google Gemini API |
| Deployment | Vercel |

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Google AI Studio](https://aistudio.google.com) API key

### 1. Clone and install

```bash
git clone <your-repo-url>
cd personal-voice-skill
npm install
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in your credentials (see [Environment Variables](#environment-variables)).

### 3. Set up Supabase

Follow the [Supabase Setup Guide](docs/SUPABASE_SETUP.md) to run the database migration and configure storage.

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |

## Project Structure

```
src/
├── actions/          # Server actions
├── app/              # Next.js App Router pages and API routes
│   ├── api/          # REST API endpoints
│   ├── dashboard/
│   ├── upload/
│   ├── voice-profile/
│   ├── generate/
│   └── evaluations/
├── components/       # React components
├── lib/
│   ├── gemini/       # Gemini AI integration
│   ├── supabase/     # Supabase clients
│   └── text/         # Text extraction and chunking
└── types/            # TypeScript types
supabase/
└── migrations/       # Database schema
docs/                 # Setup and deployment guides
```

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/POST | `/api/documents` | List or upload documents |
| POST | `/api/embeddings` | Generate embeddings |
| GET/POST | `/api/voice-profile` | Get or create voice profile |
| GET/POST | `/api/generate` | List or generate content |
| GET/POST | `/api/evaluate` | List or run evaluations |

## Documentation

- [Supabase Setup Guide](docs/SUPABASE_SETUP.md)
- [Local Development Guide](docs/LOCAL_DEVELOPMENT.md)
- [Vercel Deployment Guide](docs/VERCEL_DEPLOYMENT.md)

## License

MIT
