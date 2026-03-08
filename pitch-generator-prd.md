**PRODUCT REQUIREMENTS DOCUMENT**

**Personalized Pitch Microsite Generator**

MVP - Ready for Engineering

| **Field** | **Value** |
| --- | --- |
| Version | 3.0 |
| Status | Ready for Engineering |
| Prepared for | Claude Code |
| Scope | MVP |

# **1\. Product Overview**

A web application that turns a prospect's URL into a personalized, hosted sales microsite in under 60 seconds. The seller onboards by entering their company URL; the system scrapes it to build a reusable seller profile and design template. For each pitch, the seller enters a prospect URL, the system scrapes and infers how the seller can serve that prospect, generates structured content, and renders it as a live hosted microsite with a unique shareable link.

## **1.1 MVP Scope**

**Included in MVP:**

- Google OAuth and email/password authentication
- LinkedIn OAuth during onboarding - pull seller's own headshot, headline, and bio
- Team member management - seller can add teammates via LinkedIn OAuth invite flow
- Seller onboarding via website scraping (context + assets)
- Template preview and customization during onboarding (colors, fonts, logo)
- Dashboard: grid of saved pitches, prospect logo as key visual per card
- Pitch creation from a prospect URL
- Two-tab Pitch page: Microsite tab and Analytics tab
- Team member selector on Microsite tab - choose which teammates appear in pitch
- Optional Team section in microsite - only rendered when members are selected
- Inline text editing on Microsite tab (click-to-edit per block)
- Share button with unique URL and copy-to-clipboard
- Basic analytics: view count, session timestamps, CTA clicks

**Out of scope for MVP:**

- Org/workspace concept - team members are user-scoped in MVP
- Custom domains
- Advanced analytics (scroll depth, per-section engagement)
- LinkedIn or news scraping for prospect intelligence
- A/B pitch variants
- White-label / watermark removal (paid tier only)

# **2\. User Flow**

## **2.1 Authentication**

- User lands on the marketing / login page.
- User signs up or logs in via:

- Google OAuth ("Continue with Google")
- Email + password

- On first login, user is routed to Onboarding (Section 2.2). On subsequent logins, routed directly to Dashboard (Section 2.5).

## **2.2 Onboarding - Step 1: Company Website**

- User enters their company website URL.
- System scrapes the URL in parallel:

- Context: brand positioning, services, proof points, testimonials. Preserve original language; summarize only when necessary.
- Assets: logo (image URL), fonts (from CSS), color scheme (from CSS).

- System displays a generic pitch template preview with placeholder text, populated with scraped brand colors, fonts, and logo.
- User can customize:

- Brand colors (primary, accent, background, text) - color picker
- Fonts (display, body) - dropdown of curated Google Fonts
- Logo - file upload to replace scraped version

- User clicks "Save & Continue."

## **2.3 Onboarding - Step 2: LinkedIn Profile**

- User is prompted to connect their LinkedIn profile.
- User clicks "Connect LinkedIn." Standard OAuth 2.0 flow initiates (Sign In with LinkedIn scope).
- On successful auth, system pulls from the LinkedIn API:

- Full name
- Headline (current role / title)
- Profile photo URL
- Summary / About text (used as raw input for bio generation)

- System generates a short professional bio from the LinkedIn summary using a single LLM call. User can edit the generated bio inline.
- A TeamMember record is created for the seller (is_self = true).
- User clicks "Finish Setup." Profile is saved. User is navigated to the Dashboard.

_LinkedIn step is encouraged but skippable. If skipped, the Team section will be unavailable until the user connects later from their profile settings._

## **2.4 Team Member Management**

Team members are the seller's colleagues who can appear in pitch microsites. They are user-scoped in MVP.

- From Settings > Team, the seller can invite teammates by email.
- Invitee receives an email with a link. On clicking, they are prompted to sign up (or log in) and connect their LinkedIn profile via OAuth.
- On LinkedIn connect, a TeamMember record is created and associated with the inviting user's team pool.
- Team members do not have their own dashboard or pitch access in MVP - they are profile records only.

_Post-MVP: team members become full users in an org/workspace, with shared pitch libraries and collaborative editing._

## **2.5 Dashboard**

The dashboard is the primary navigation hub, displayed as a grid of pitch cards.

- Each card: prospect logo (key visual), company name, domain, creation date, status badge (Generating / Ready / Viewed / Clicked).
- Cards link directly to their Pitch page.
- Empty state: illustration + "Create your first pitch" prompt + New Pitch button.
- "New Pitch" button always visible (top-right).
- Back arrow on Pitch page returns user to Dashboard.

## **2.6 New Pitch Flow**

- User clicks "New Pitch" from Dashboard.
- Modal prompts for prospect URL.
- System checks for duplicate domain. If found, redirects to existing pitch with informational banner.
- System scrapes prospect URL: company name, industry, size signals, tone, services, recent signals, logo, hero image, colors, fonts.
- LLM generates pitch content JSON using seller profile + prospect data.
- System renders microsite HTML. User navigated to Pitch page.

## **2.7 Pitch Page - Microsite Tab**

- Displays the rendered microsite in an iframe or inline preview.
- Each text block is click-to-edit. Changes save on blur, write back to content JSON, trigger re-render.
- "Share" button (top-right) shows unique public URL + "Copy Link" button.
- "Back" button (top-left) returns to Dashboard.

**Team Member Selector**

- A sidebar or panel on the Microsite tab shows the seller's team member pool as avatar cards (photo + name + title).
- Seller checks or unchecks team members to include them in this pitch.
- Selection is pitch-specific - the same person can appear in some pitches and not others.
- When at least one member is selected, a "Meet Your Team" section is rendered in the microsite between the Proof and CTA sections.
- When no members are selected, the Team section is omitted entirely from the microsite.
- Changes to selection trigger an immediate re-render.

## **2.8 Pitch Page - Analytics Tab**

- Total views
- First viewed / last viewed timestamps
- Average session duration
- CTA click count
- Individual session log: timestamp, duration, event type

# **3\. Pages & Navigation**

| **Route** | **Description** |
| --- | --- |
| /login | Authentication - Google OAuth + email/password |
| /onboarding/website | Step 1: Company URL input + template customization |
| /onboarding/linkedin | Step 2: LinkedIn OAuth connect + bio review |
| /dashboard | Pitch grid + New Pitch button |
| /settings/team | Team member management - invite + view roster |
| /pitches/\[id\] | Pitch page - Microsite tab + Analytics tab |
| /p/\[slug\] | Public microsite - served to prospects, unauthenticated |

# **4\. Data Models**

## **4.1 User**

id UUID, primary key

email String, unique

password_hash String, nullable

google_id String, nullable

linkedin_id String, nullable

linkedin_access_token String, nullable -- stored encrypted

onboarding_complete Boolean, default false

created_at Timestamp

## **4.2 TeamMember**

id UUID, primary key

owner_user_id UUID, foreign key → User -- the seller who owns this pool

is_self Boolean -- true when this record is the seller themselves

full_name String

headline String -- LinkedIn headline / current role

photo_url String -- LinkedIn profile photo URL

bio Text -- LLM-generated short bio, editable

linkedin_id String, nullable

linkedin_profile_url String, nullable

created_at Timestamp

updated_at Timestamp

## **4.3 SellerProfile**

id UUID, primary key

user_id UUID, foreign key → User (one-to-one)

website_url String

company_name String

tagline String

services JSON Array of { title, description }

proof_points JSON Array of { stat, label }

testimonials JSON Array of { quote, attribution }

client_logos JSON Array of { name, url }

logo_url String, nullable

logo_file_key String, nullable

brand_colors JSON { background, primary, accent, text }

fonts JSON { display, body }

raw_scrape Text

created_at Timestamp

updated_at Timestamp

## **4.4 Pitch**

id UUID, primary key

user_id UUID, foreign key → User

prospect_url String

prospect_domain String -- normalized, for deduplication

status Enum: generating | ready | failed

slug String, unique

prospect_data JSON { company_name, industry, tone, size_estimate,

pain_points\[\], recent_signals\[\], logo_url,

hero_image_url, brand_colors, fonts }

content JSON -- see Section 6.2

selected_team_members UUID\[\] -- array of TeamMember IDs for this pitch

view_count Integer, default 0

first_viewed_at Timestamp, nullable

last_viewed_at Timestamp, nullable

created_at Timestamp

updated_at Timestamp

UNIQUE CONSTRAINT on (user_id, prospect_domain)

## **4.5 TrackingEvent**

id UUID, primary key

pitch_id UUID, foreign key → Pitch

event_type Enum: view | cta_click

ip_address String (hashed)

user_agent String

duration_seconds Integer, nullable

created_at Timestamp

# **5\. LinkedIn OAuth Integration**

## **5.1 Scope & Flow**

LinkedIn's "Sign In with LinkedIn using OpenID Connect" product is used. This is freely available without LinkedIn Partner approval and covers the seller's own profile only.

- User clicks "Connect LinkedIn" in onboarding or settings.
- App redirects to LinkedIn OAuth with scopes: openid, profile, email.
- User authenticates on LinkedIn and grants permission.
- LinkedIn redirects back with authorization code.
- Server exchanges code for access token.
- Server calls LinkedIn API: GET /v2/userinfo (OpenID Connect endpoint).
- Response includes: sub (LinkedIn ID), name, email, picture (photo URL), locale.
- Server calls GET /v2/me?projection=(id,firstName,lastName,headline,summary) if additional scopes are approved.
- TeamMember record is created or updated.
- LLM generates bio from LinkedIn summary. Bio stored in TeamMember.bio, editable by user.

## **5.2 Bio Generation Prompt**

_System: You are writing a short professional bio for a sales microsite. Write in third person. Be specific, confident, and concise. No fluff. Max 3 sentences._

Write a short professional bio for the following person.

Name: {full_name}

Title: {headline}

LinkedIn summary: {summary}

Rules:

\- Third person ("Jane leads..." not "I lead...")

\- Max 3 sentences

\- Lead with their current role and expertise

\- End with something specific that establishes credibility

\- No generic filler phrases

## **5.3 Team Invite Flow**

- Seller goes to Settings > Team and clicks "Invite Teammate."
- Seller enters invitee's email address.
- System sends invite email with a unique signup link.
- Invitee clicks link, creates an account (or logs in), and is prompted to connect LinkedIn.
- On LinkedIn connect, a TeamMember record is created linked to the inviting seller's owner_user_id.
- Seller sees the new teammate appear in their team roster and team selector panel.

# **6\. Content Generation**

## **6.1 Generation Steps**

- Prospect scraping completes.
- System loads SellerProfile.
- LLM call 1: Extract structured prospect intelligence from raw scrape.
- LLM call 2: Generate full pitch content JSON.
- Store result in pitch.content. Update pitch.status to ready.
- Render microsite HTML from content JSON + seller template + prospect accent layer.
- If selected_team_members is populated, render Team section; otherwise omit it.
- Store HTML. Navigate user to Pitch page.

## **6.2 Content JSON Schema**

Fixed 8-section structure. All fields required except "team" which is conditional. This schema is the pitch template used during onboarding preview (with placeholder values).

{ "meta": { "page_title": string, "prepared_for": string },

"hero": { "eyebrow": string, "headline": string,

"subheadline": string, "cta_text": string, "cta_url": string },

"context": { "heading": string, "body": string },

"opportunity": { "heading": string, "intro": string,

"items": \[{ "title": string, "body": string }\] },

"services": { "heading": string, "intro": string,

"items": \[{ "name": string, "description": string,

"relevance": string }\] },

"proof": { "heading": string,

"stats": \[{ "value": string, "label": string }\],

"testimonial": { "quote": string, "attribution": string } },

"team": { "heading": string, -- conditional, omit if no members selected

"members": \[{ "team_member_id": UUID }\] },

"cta": { "heading": string, "body": string,

"button_text": string, "button_url": string } }

# **7\. Scraping Pipeline**

Cheerio + node-fetch. No headless browser for MVP. All scraping is best-effort - the system always produces output.

## **7.1 Seller Scraper**

- Fetch homepage + up to 3 pages (About, Services, Case Studies, Pricing).
- Preserve original language. Summarize only when content is excessive.
- Extract logo, fonts (from CSS @import and @font-face), colors (from CSS selectors and custom properties).
- Pass text to LLM for structured extraction (seller profile prompt).
- Fallbacks: CSS fail → skip design extraction, flag for manual input. Logo fail → null, prompt upload. Sparse content → proceed with what's available.

## **7.2 Prospect Scraper**

- Fetch homepage + up to 3 pages (About, Services, Blog/News).
- Preserve original language in full. Capture: what they do, who they serve, size signals, recent activity.
- Extract logo, hero image, colors, fonts via same CSS parsing.
- Pass text to LLM for prospect intelligence extraction.
- Fallbacks: React/SPA → parse available text, flag low-confidence. No hero image → color-only hero. No colors → neutral defaults (#ffffff, #111111, #0066ff).

# **8\. LLM Prompts**

## **8.1 Seller Profile Extraction**

_System: Extract structured company info from scraped content. Preserve original language. Summarize only when excessive. Return valid JSON only, no preamble._

SCRAPED CONTENT: {raw_text}

Return: { company_name, tagline, services\[{title,description}\],

proof_points\[{stat,label}\], testimonials\[{quote,attribution}\] }

Preserve original phrasing. Empty array if no data for a field.

## **8.2 Prospect Intelligence Extraction**

_System: Extract business intelligence from scraped prospect website. Preserve original language. Return valid JSON only, no preamble._

SCRAPED CONTENT: {raw_text}

Return: { company_name, industry,

tone: "formal"|"casual"|"technical"|"creative",

size_estimate: "small (<50)"|"mid-market (50-500)"|"enterprise (500+)",

pain_points: string\[\], recent_signals: string\[\] }

Use best inference - no nulls.

## **8.3 Pitch Content Generation**

_System: World-class B2B copywriter. Write with clarity, confidence, specificity. Mirror prospect language. Show genuine understanding of their business. Return valid JSON only, no preamble._

SELLER: { company_name, tagline, services, proof_points, testimonials, cta_url }

PROSPECT: { company_name, industry, tone, size_estimate, pain_points, recent_signals }

Return JSON matching schema in Section 6.2.

Rules:

\- Headline specific to this prospect - never generic

\- Context shows genuine knowledge of prospect business

\- Opportunity items map to prospect pain points directly

\- Services explain why each applies to THIS prospect specifically

\- Match writing tone to prospect tone field

\- No empty strings

## **8.4 Bio Generation**

_System: Write a short professional bio for a sales microsite. Third person. Specific, confident, concise. Max 3 sentences. No filler._

Name: {full_name}

Title: {headline}

LinkedIn summary: {summary}

Rules: Third person. Lead with role and expertise. End with specific credibility signal.

# **9\. Microsite Renderer**

## **9.1 Design Archetypes**

Five archetypes selected by prospect's inferred tone:

| **Tone** | **Font Pair** | **Color Approach** |
| --- | --- | --- |
| formal | Playfair Display + Source Sans 3 | Dark navy + white + gold accent |
| casual | DM Sans + DM Serif Display | Warm off-white + deep green |
| technical | JetBrains Mono + Inter | Near-black + white + electric blue |
| creative | Fraunces + Outfit | White + black + prospect accent |
| default | Plus Jakarta Sans + Lora | White + charcoal + prospect accent |

## **9.2 Design Token Hierarchy**

Seller brand is primary. Prospect brand is accent layer only.

:root {

\--seller-primary: #hex;

\--seller-accent: #hex;

\--font-display: "Font", fallback;

\--font-body: "Font", fallback;

\--prospect-accent: #hex; /\* eyebrow, borders, highlights \*/

\--prospect-bg: #hex; /\* hero section background only \*/

}

## **9.3 Section Render Order**

| **Section** | **Description** |
| --- | --- |
| 1\. Nav | Seller logo (left) + Share/CTA button (right) |
| 2\. Hero | Prospect logo + eyebrow + headline + subheadline + CTA. Background: prospect hero image or prospect brand color. |
| 3\. Context | "We understand your business." Full-width text. Prospect accent left border. |
| 4\. Opportunity | 3-column card grid. One card per opportunity item. |
| 5\. Services | Alternating layout. Name, description, prospect-specific relevance per service. |
| 6\. Proof | Stat blocks + full-width testimonial quote. |
| 7\. Team (conditional) | Rendered only when selected_team_members is non-empty. Photo, name, title, bio per member. Horizontal card row. |
| 8\. CTA | Full-width closing section. Seller brand color background. |
| 9\. Footer | Seller name + "Powered by \[Product\]" watermark. |

## **9.4 Team Section Detail**

- Renders as a horizontal row of member cards.
- Each card: circular headshot, full name, headline, 2-sentence bio.
- Card order matches order of selection in the team selector UI.
- If a member has no LinkedIn photo, render initials avatar in seller accent color.
- Section heading pulled from content JSON "team.heading" field.

## **9.5 Inline Editing**

- Each content block on the Microsite tab is click-to-edit (contenteditable or textarea overlay).
- Save on blur via PATCH /pitches/{id}/content.
- Microsite HTML re-renders in background. Public URL always serves latest version.
- Team section text (heading) is editable. Team member bios are not editable inline - edit via Settings > Team.

## **9.6 Hosting**

- Single self-contained HTML file per pitch.
- Stored in Supabase Storage or Cloudflare R2.
- Served at: <https://pitch.\[product-domain\].com/{slug}>
- Slug format: {prospect-domain-slug}-{6-char-random}
- Tracking script embedded before &lt;/body&gt;.

# **10\. Tracking**

Tracking script embedded in every public microsite. Events: view (on load), view with duration (on unload), cta_click (on CTA button tap).

## **10.1 Analytics Tab Metrics**

| **Metric** | **Source** |
| --- | --- |
| Total views | pitch.view_count |
| First viewed | pitch.first_viewed_at |
| Last viewed | pitch.last_viewed_at |
| Avg. session duration | Avg of duration_seconds across TrackingEvents |
| CTA clicks | Count of cta_click TrackingEvents |
| Session log | All TrackingEvents ordered by created_at desc |

# **11\. API Endpoints**

| **Endpoint** | **Description** |
| --- | --- |
| POST /auth/signup | Create account with email + password |
| POST /auth/login | Login, return JWT |
| GET /auth/google | Initiate Google OAuth |
| GET /auth/google/callback | Google OAuth callback |
| GET /auth/linkedin | Initiate LinkedIn OAuth (OpenID Connect) |
| GET /auth/linkedin/callback | LinkedIn OAuth callback - create TeamMember, generate bio |
| POST /auth/logout | Logout |
| GET /profile | Get seller profile |
| POST /profile | Create profile from URL - triggers seller scraping |
| PUT /profile | Update profile fields + template customizations |
| GET /team | List all TeamMembers for user |
| POST /team/invite | Send invite email to teammate |
| PUT /team/{id} | Update TeamMember bio or details |
| DELETE /team/{id} | Remove TeamMember from pool |
| GET /pitches | List all pitches |
| POST /pitches | Create pitch from prospect URL - triggers scraping + generation |
| GET /pitches/{id} | Get pitch detail including content JSON |
| PATCH /pitches/{id}/content | Update content JSON fields (inline editor) |
| PATCH /pitches/{id}/team | Update selected_team_members for this pitch - triggers re-render |
| DELETE /pitches/{id} | Delete pitch |
| GET /pitches/{id}/status | Poll generation status |
| GET /pitches/{id}/analytics | Analytics summary + session log |
| POST /track \[PUBLIC\] | Ingest tracking event - unauthenticated, rate limited |
| GET /p/{slug} \[PUBLIC\] | Serve public microsite HTML |

# **12\. Tech Stack**

| **Layer** | **Choice - Rationale** |
| --- | --- |
| Framework | Next.js (App Router) - Full-stack, SSR, API routes |
| Database | Postgres via Supabase - Auth + DB + file storage in one |
| Auth | Supabase Auth - Google OAuth + email/password built-in |
| LinkedIn OAuth | passport-linkedin-oauth2 or custom OpenID Connect flow |
| Job Queue | pg-boss (Postgres-backed) - No Redis needed for MVP |
| Scraping | Cheerio + node-fetch - No headless browser for MVP |
| LLM | Anthropic Claude API (claude-sonnet-4-20250514) |
| File Storage | Supabase Storage - Logo uploads + microsite HTML files |
| Microsite CDN | Cloudflare Pages or Vercel - Static serving, custom subdomain |
| Styling | Tailwind CSS |
| Deployment | Vercel |

# **13\. Error Handling**

| **Scenario** | **Behavior** |
| --- | --- |
| Prospect site blocks scraper | Proceed with minimal data; LLM generates generic content; notify user with low-confidence banner |
| Prospect site is React/SPA | Parse available text; show low-confidence flag |
| LLM returns malformed JSON | Retry once; if fails again, set status to failed, show error + retry button |
| CSS file unreachable | Skip design extraction; use archetype defaults; flag for manual input |
| Logo not found | Null; prompt upload in template step |
| LinkedIn OAuth fails | Show error; allow skip; LinkedIn features unavailable until connected |
| LinkedIn API returns no photo | Render initials avatar in seller accent color |
| Duplicate prospect URL | Redirect to existing pitch with informational banner |
| Generation exceeds 60s | Show "still working"; continue in background; update dashboard on complete |
| Inline edit save fails | Error toast; revert to last saved value |
| Team re-render fails | Show error; keep previous microsite version live |

# **14\. MVP Constraints**

- No headless browser - Cheerio + node-fetch only. JS-rendered sites degrade gracefully.
- One pitch per prospect domain per user - unique constraint at DB level.
- Rigid content schema - 9-section layout fixed (Team is conditional). No free-form sections.
- No custom domains - all microsites on product subdomain.
- Watermark on free tier - removable on paid plan.
- Inline editor in scope - text fields only. No drag-and-drop reordering.
- Team members are user-scoped - no org/workspace concept in MVP.
- LinkedIn OAuth covers seller's own profile only - no scraping third-party profiles.
- Team member bios are editable in Settings > Team, not inline on the Microsite tab.

# **15\. Success Metrics for MVP**

| **Metric** | **Target** |
| --- | --- |
| Time from prospect URL to shareable link | < 60 seconds |
| Pitch generation success rate | \> 90% |
| Content quality (sendable without editing) | \> 70% of cases - user surveys |
| Tracking event delivery rate | \> 95% |
| LinkedIn connect rate during onboarding | \> 60% of users |
| Onboarding completion rate | \> 80% of signups |