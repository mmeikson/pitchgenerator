# Build Approach: Avolor — Personalized Pitch Microsite Generator

## Overview

Full-stack Next.js app (App Router) backed by Supabase (Postgres + Auth + Storage), with a Postgres-backed background worker for scraping and generation. The core loop: seller onboards once via their company website → enters a prospect URL → system scrapes, generates, and renders a hosted microsite in <60 seconds with a real-time progress bar.

---

## Scope Cuts from PRD

The following are removed from MVP:

- **LinkedIn OAuth entirely** — no seller profile photo/bio from LinkedIn, no TeamMember model, no team selector on the Pitch page
- **Team member management** — no invite flow, no Settings > Team page
- **Team section in microsite** — removed; microsite is a fixed 8-section layout with no conditional sections

This simplifies the data model (no `TeamMember` table), the onboarding flow (website step only, no LinkedIn step), the Pitch page (no team selector sidebar), and the content JSON schema (no `team` field).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Database | Postgres via Supabase |
| Auth | Supabase Auth (Google OAuth + email/password) |
| Background Worker | Separate Node.js process on Railway, using pg-boss |
| Scraping | Cheerio + node-fetch |
| LLM | Anthropic Claude API (`claude-sonnet-4-6`) |
| File Storage | Supabase Storage (logo uploads + microsite HTML) |
| Styling | Tailwind CSS |
| Deployment | Vercel (app) + Railway (worker) |

---

## Key Architectural Decisions

### 1. Separate Worker Process

The scrape-and-generate pipeline (scrape → LLM × 2 → render → upload) may take 30–60s. Rather than fight Vercel function timeouts, we run a dedicated Node.js worker on Railway that pulls jobs from pg-boss.

- Next.js API route enqueues the job and returns immediately
- Client polls `GET /api/pitches/[id]/status` every 2 seconds
- Worker processes the job and updates `pitch.status` + `pitch.content` in Postgres
- Progress bar on the UI reflects status transitions: `queued → scraping → generating → rendering → ready`

The worker is a simple `src/worker.ts` entrypoint that initializes pg-boss and registers job handlers. It shares the same `/lib` code as the Next.js app.

### 2. Microsite Serving

Public microsites are static self-contained HTML files stored in Supabase Storage, served at:

```
https://pitch.avolor.com/{slug}
```

In the Next.js app, `/app/p/[slug]/route.ts` fetches the HTML from Supabase Storage and streams it. A `next.config.js` rewrite maps the `pitch.avolor.com` subdomain to this route — same Vercel deployment, no separate project.

Slug format: `{prospect-domain}-{6-char-random}` (e.g., `acmecorp-x4f9k2`)

### 3. Editor Preview vs. Public HTML

The Pitch page inline editor renders directly from the `content` JSON stored in Postgres — not from the stored HTML file. This means:

- Edits appear instantly in the preview (optimistic update from local state, confirmed on blur save)
- `PATCH /api/pitches/[id]/content` updates the DB and queues a background `rerender` job
- The public HTML file is regenerated in the background; the prospect always sees the last successfully uploaded version
- Text-only editing for MVP (no drag-and-drop, no section reordering)

### 4. Onboarding Flow (Simplified)

Two steps reduced to one: seller enters their company URL, system scrapes and extracts brand context + assets, seller customizes colors/fonts/logo, saves. Done — routed to Dashboard.

No LinkedIn step. No second onboarding screen.

---

## Data Models (Simplified)

### User
```
id                  UUID, primary key
email               String, unique
password_hash       String, nullable
google_id           String, nullable
onboarding_complete Boolean, default false
created_at          Timestamp
```

### SellerProfile
```
id              UUID, primary key
user_id         UUID, FK → User (one-to-one)
website_url     String
company_name    String
tagline         String
services        JSON  [{ title, description }]
proof_points    JSON  [{ stat, label }]
testimonials    JSON  [{ quote, attribution }]
client_logos    JSON  [{ name, url }]
logo_url        String, nullable
logo_file_key   String, nullable
brand_colors    JSON  { background, primary, accent, text }
fonts           JSON  { display, body }
raw_scrape      Text
created_at      Timestamp
updated_at      Timestamp
```

### Pitch
```
id                UUID, primary key
user_id           UUID, FK → User
prospect_url      String
prospect_domain   String  (normalized, for deduplication)
calendar_url      String  (entered at pitch creation, used as CTA button href)
status            Enum: queued | scraping | generating | rendering | ready | failed
slug              String, unique
prospect_data     JSON  { company_name, industry, tone, size_estimate,
                          pain_points[], recent_signals[], logo_url,
                          hero_image_url, brand_colors, fonts }
content           JSON  (see Content Schema below)
view_count        Integer, default 0
first_viewed_at   Timestamp, nullable
last_viewed_at    Timestamp, nullable
created_at        Timestamp
updated_at        Timestamp

UNIQUE (user_id, prospect_domain)
```

### TrackingEvent
```
id               UUID, primary key
pitch_id         UUID, FK → Pitch
event_type       Enum: view | cta_click
ip_address       String (hashed)
user_agent       String
duration_seconds Integer, nullable
created_at       Timestamp
```

---

## Content JSON Schema (8 sections, no Team)

```json
{
  "meta":        { "page_title": string, "prepared_for": string },
  "hero":        { "eyebrow": string, "headline": string,
                   "subheadline": string, "cta_text": string, "cta_url": string },
  "context":     { "heading": string, "body": string },
  "opportunity": { "heading": string, "intro": string,
                   "items": [{ "title": string, "body": string }] },
  "services":    { "heading": string, "intro": string,
                   "items": [{ "name": string, "description": string, "relevance": string }] },
  "proof":       { "heading": string,
                   "stats": [{ "value": string, "label": string }],
                   "testimonial": { "quote": string, "attribution": string } },
  "cta":         { "heading": string, "body": string,
                   "button_text": string, "button_url": string }
}
```

---

## Routes

| Route | Description |
|---|---|
| `/login` | Google OAuth + email/password |
| `/onboarding` | Company URL input → scraping → template customization |
| `/dashboard` | Pitch grid + New Pitch button |
| `/pitches/[id]` | Pitch page — Microsite tab + Analytics tab |
| `/p/[slug]` | Public microsite (unauthenticated) |

Settings page deferred — no team management needed in MVP.

---

## API Endpoints

| Endpoint | Description |
|---|---|
| `POST /api/auth/signup` | Email + password signup |
| `POST /api/auth/login` | Login, return session |
| `GET /api/auth/google` | Google OAuth initiation |
| `GET /api/auth/google/callback` | Google OAuth callback |
| `POST /api/auth/logout` | Logout |
| `GET /api/profile` | Get seller profile |
| `POST /api/profile` | Create profile from URL (triggers seller scrape job) |
| `PUT /api/profile` | Update profile + template customizations |
| `GET /api/pitches` | List all pitches |
| `POST /api/pitches` | Create pitch from prospect URL (enqueues job) |
| `GET /api/pitches/[id]` | Get pitch detail + content JSON |
| `GET /api/pitches/[id]/status` | Poll generation status |
| `PATCH /api/pitches/[id]/content` | Update content fields (inline editor) |
| `DELETE /api/pitches/[id]` | Delete pitch |
| `GET /api/pitches/[id]/analytics` | Analytics summary + session log |
| `POST /api/track` | Ingest tracking event (public, rate-limited) |
| `GET /p/[slug]` | Serve public microsite HTML |

---

## Build Sequence

### Phase 1 — Foundation
- Next.js + Tailwind + TypeScript project scaffold
- Supabase client setup (server + browser)
- DB migrations (4 tables)
- Supabase Auth: Google OAuth + email/password
- Middleware: redirect unauthenticated users to `/login`, redirect incomplete onboarding to `/onboarding`

### Phase 2 — Seller Onboarding
- Seller scraper: fetch homepage + up to 3 pages, extract text, CSS (logo, fonts, colors)
- LLM extraction: seller profile prompt → structured JSON
- `POST /api/profile` + pg-boss `seller-scrape` job
- Onboarding UI: URL input → progress indicator → template preview with live brand tokens
- Color picker, Google Fonts dropdown, logo upload (Supabase Storage)
- `PUT /api/profile` saves customizations → sets `onboarding_complete = true` → redirect to Dashboard

### Phase 3 — Dashboard + New Pitch
- Dashboard: pitch card grid (prospect logo, name, domain, date, status badge)
- Empty state
- New Pitch modal: prospect URL + calendar URL inputs → duplicate domain check → enqueue `pitch-generate` job → navigate to Pitch page in `queued` state

### Phase 4 — Generation Worker
- Railway worker process: pg-boss init + job handler registration
- `pitch-generate` job: prospect scrape → LLM call 1 (intelligence extraction) → LLM call 2 (content JSON generation) → HTML render → Supabase Storage upload → status `ready`
- Status transitions written to DB at each step: `queued → scraping → generating → rendering → ready`
- Error handling: LLM JSON retry once, then `failed`

### Phase 5 — Microsite Renderer
- HTML generator from content JSON + seller brand tokens + prospect archetype
- 5 design archetypes (tone → font pair + color scheme)
- CSS token hierarchy: seller brand primary, prospect brand accent-only
- Self-contained HTML (inlined CSS, Google Fonts link, tracking script before `</body>`)

### Phase 6 — Pitch Page
- Progress bar polling `GET /api/pitches/[id]/status` until `ready`
- Microsite tab: inline preview rendered from content JSON (React components matching microsite sections)
- Click-to-edit text blocks: `contenteditable`, save on blur → `PATCH /api/pitches/[id]/content` → queues `rerender` job
- Analytics tab: view count, first/last viewed, avg session duration, CTA clicks, session log

### Phase 7 — Tracking
- Tracking script template: fires `view` on load, `view` with duration on `visibilitychange`/`unload`, `cta_click` on CTA button click
- `POST /api/track`: unauthenticated, rate-limited by IP, writes `TrackingEvent`, updates pitch aggregate fields

### Phase 8 — Polish
- Low-confidence banner (when scraper got minimal data)
- Duplicate domain redirect with informational banner
- Generation timeout handling ("Still working..." state after 60s)
- Inline edit error toast + revert on save failure
- Share button: displays `pitch.avolor.com/{slug}` + copy-to-clipboard
- Back navigation: Pitch page → Dashboard

---

## Resolved Decisions

- `/` is a minimal landing page: product name + link to `/login`. Placeholder for a real marketing page post-MVP.
