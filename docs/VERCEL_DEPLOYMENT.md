# Vercel Deployment Guide

Deploy Personal Voice Skill to Vercel in a few steps.

## Prerequisites

- A [Vercel](https://vercel.com) account
- A configured Supabase project
- A Google Gemini API key
- This repository pushed to GitHub

## 1. Import Project

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. Vercel auto-detects Next.js — keep the default settings:
   - **Framework Preset**: Next.js
   - **Build Command**: `next build`
   - **Output Directory**: `.next`

## 2. Environment Variables

In the Vercel project settings, add these environment variables for **Production**, **Preview**, and **Development**:

| Variable | Value |
|----------|-------|
| `GEMINI_API_KEY` | Your Google Gemini API key |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key |

> Mark `SUPABASE_SERVICE_ROLE_KEY` as sensitive. Do not prefix it with `NEXT_PUBLIC_`.

## 3. Update Supabase Auth URLs

After your first deploy, update Supabase authentication settings:

1. Go to Supabase → **Authentication → URL Configuration**
2. Set **Site URL** to your Vercel production URL (e.g. `https://personal-voice-skill.vercel.app`)
3. Add to **Redirect URLs**:
   - `https://personal-voice-skill.vercel.app/**`
   - `https://*.vercel.app/**` (for preview deployments)

## 4. Deploy

Click **Deploy**. Vercel will:

1. Install dependencies
2. Run `next build`
3. Deploy to a global CDN

## 5. Verify Deployment

After deployment:

1. Visit your Vercel URL
2. Sign up with a new account
3. Upload a writing sample
4. Create a voice profile
5. Generate and evaluate content

## Configuration Notes

### Serverless Function Timeout

API routes that call Gemini (upload processing, voice profile, generation, evaluation) set `maxDuration = 60` for Vercel Pro. On the Hobby plan, the default 10-second limit may cause timeouts for large documents. Options:

- Upgrade to Vercel Pro for 60-second functions
- Upload smaller documents during testing
- Split large files into smaller samples

### Node.js Runtime

PDF parsing and Gemini SDK require the Node.js runtime. All API routes specify:

```typescript
export const runtime = "nodejs";
```

### Server Actions Body Size

File uploads up to 10MB are supported via:

```typescript
// next.config.ts
experimental: {
  serverActions: {
    bodySizeLimit: "10mb",
  },
},
```

## Custom Domain (Optional)

1. Go to Vercel → **Settings → Domains**
2. Add your custom domain
3. Update Supabase Auth URLs to include the custom domain

## Monitoring

- **Vercel Analytics** — enable in project settings for traffic insights
- **Vercel Logs** — check function logs for API errors
- **Supabase Dashboard** — monitor database usage and auth events

## Troubleshooting

### 500 errors on upload/generation
Check Vercel function logs. Common causes:
- Missing `GEMINI_API_KEY`
- Function timeout (document too large)
- Supabase RLS blocking inserts

### Auth redirect fails after login
Ensure Supabase Site URL and Redirect URLs include your Vercel domain.

### "Vector search failed"
Confirm the database migration ran successfully and the `match_chunks` function exists.

### Build succeeds but pages are blank
Check browser console for hydration errors. Ensure all `NEXT_PUBLIC_*` env vars are set.

## Redeployment

Vercel auto-deploys on every push to your main branch. Preview deployments are created for pull requests.

To manually redeploy: Vercel Dashboard → **Deployments** → **Redeploy**.
