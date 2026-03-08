# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
```

## Architecture

**Avolor** is a Next.js App Router app that turns a prospect URL into a personalized, hosted sales microsite. See `build-approach.md` for full decisions and phasing.

### Key directories

- `app/(auth)/` — Unauthenticated pages (login)
- `app/(app)/` — Authenticated pages (dashboard, onboarding, pitches)
- `app/p/[slug]/` — Public microsite served to prospects (no auth)
- `app/api/` — API routes
- `lib/supabase/` — Supabase clients: `client.ts` (browser), `server.ts` (server components/actions)
- `lib/scraper/` — Cheerio + node-fetch scrapers (seller + prospect)
- `lib/llm/` — Claude API calls and prompt templates
- `lib/renderer/` — HTML generator for microsites (design archetypes, CSS tokens)
- `lib/jobs/` — pg-boss job definitions and handlers
- `db/migrations/` — SQL migrations (run in Supabase SQL editor)

### Auth flow

Supabase Auth handles Google OAuth and email/password. LinkedIn is **out of scope for MVP**.

- `middleware.ts` guards all app routes: no session → `/login`, incomplete onboarding → `/onboarding`
- OAuth redirect target: `/api/auth/callback`
- Supabase creates an `auth.users` record; a trigger auto-creates a matching `public.profiles` row

### Background jobs

A separate Node.js worker process (deployed on Railway) uses `pg-boss` (Postgres-backed queue). It shares `lib/` code with the Next.js app. Job types:
- `pitch-generate` — scrape → LLM × 2 → render HTML → upload to Supabase Storage
- `rerender` — regenerate HTML after content edits

### Microsite hosting

Static HTML files stored in Supabase Storage, served at `/p/[slug]`. The public subdomain `pitch.avolor.com` is routed here via `next.config.js` rewrite.

### Data models

Four tables: `profiles` (extends `auth.users`), `seller_profiles`, `pitches`, `tracking_events`. See `db/migrations/001_initial_schema.sql` for full schema with RLS policies.

### LLM

Use `claude-sonnet-4-6`. Three call types: seller profile extraction, prospect intelligence extraction, pitch content generation. All must return valid JSON — wrap in try/catch, retry once on parse failure.

### Environment variables

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
- `SUPABASE_SERVICE_ROLE_KEY` — for worker and tracking endpoint (bypasses RLS)
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` in dev, production URL in prod
