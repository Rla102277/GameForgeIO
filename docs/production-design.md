# AI Board Game Factory — Production Design Document

**Version**: 1.0  
**Date**: April 2026  
**Status**: Production-ready (pre-deployment)

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [System Architecture](#2-system-architecture)
3. [Frontend](#3-frontend)
4. [Backend API](#4-backend-api)
5. [Database Schema](#5-database-schema)
6. [AI System](#6-ai-system)
7. [Authentication & User Management](#7-authentication--user-management)
8. [Key Data Flows](#8-key-data-flows)
9. [Monorepo Package Structure](#9-monorepo-package-structure)
10. [Environment & Configuration](#10-environment--configuration)
11. [Build & Deployment](#11-build--deployment)

---

## 1. Product Overview

**AI Board Game Factory** is a professional dark-mode SaaS platform for board game designers. It combines structured ontology management, AI-assisted content generation, Monte Carlo economic simulation, and publication-ready asset export — all in a single project workspace.

### Target Users

- Independent board game designers
- Game design studios working on client projects
- Publishers who need to evaluate or format design documents

### Core Value Propositions

- **Centralized workspace** — one project holds entities, rules, playtesting data, assets, and notes
- **AI partner at every stage** — narrative AI for creative tasks, analytical AI for balance and structure
- **Simulation before playtesting** — Monte Carlo economy modelling catches imbalance before physical production
- **One-click publishing outputs** — press kits, sell sheets, Tabletop Simulator exports, Kickstarter copy, rulebooks

---

## 2. System Architecture

### High-Level Topology

```
Browser (React + Vite)
        │  HTTP / SSE
        ▼
  Replit Proxy  ──►  /          →  Frontend  (port from $PORT)
                ──►  /api       →  API Server (port 8080)
                         │
                         ▼
                  PostgreSQL (Drizzle ORM)
                         │
                         ▼
           ┌─────────────┴──────────────┐
           Anthropic SDK         OpenAI SDK
           (Claude models)    (GPT + DALL-E 3 + Gemini + xAI via baseURL)
```

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + Vite |
| Styling | Tailwind CSS v4 + Shadcn UI |
| Routing | Wouter (hash-free path routing) |
| Server state | TanStack Query (React Query) |
| Backend | Node.js + Express |
| Database ORM | Drizzle ORM |
| Database | PostgreSQL (Replit-provisioned) |
| Auth | Clerk (frontend ClerkProvider + backend @clerk/express) |
| AI — Anthropic | @anthropic-ai/sdk |
| AI — OpenAI/Gemini/xAI | openai SDK (with baseURL override) |
| Image generation | OpenAI gpt-image-1 (DALL-E 3) |
| File parsing | multer (upload) + pdf-parse (text extraction) |
| API contract | OpenAPI 3.1 YAML |
| Code generation | Orval (React Query hooks + Zod schemas from OpenAPI spec) |
| Logging | Pino |
| Monorepo | pnpm workspaces |
| Build tool (API) | esbuild (via custom build.mjs) |

---

## 3. Frontend

### Pages & Routes

| Route | Component | Auth Required | Description |
|---|---|---|---|
| `/` | `Dashboard` | No (redirects to sign-in) | Project list, creation dialogs |
| `/sign-in/*` | `SignInPage` (Clerk) | — | Clerk-hosted sign-in |
| `/sign-up/*` | `SignUpPage` (Clerk) | — | Clerk-hosted sign-up |
| `/projects/:id` | `ProjectWorkspace` | Yes (ProtectedWorkspace) | Full project workspace |
| `/feedback/:id` | `FeedbackPage` | No (public) | External playtester feedback form |
| `/changelog` | `ChangelogPage` | No | Public change log |
| `/account` | `AccountPage` | Yes (ProtectedAccount) | Profile + AI provider settings |
| `/admin` | `AdminPage` | Yes (admin role) | User management panel |

### Project Workspace — Tabs

The workspace is a single-page multi-tab shell. All tabs are lazy-rendered; the active tab is stored in URL query state.

| # | Tab | Key Features |
|---|---|---|
| 1 | **Overview** | Project metadata editor (name, genre, player count, duration, "for client"), Complexity Score widget (0-100 BGG-style), PDF/TXT file upload, URL fetch & parse, AI Game Architect blueprint (SSE streaming), AI Design Advisor chat (persistent, loads from DB on mount) |
| 2 | **Research** | Research item CRUD, competitive reference links, fetch-URL scraping, AI research chat |
| 3 | **Ontology** | Entity builder (Item / Faction / Location / Event), per-entity custom properties, SVG Relationship Map (radial, auto-detects links from description text), AI Generate Entities panel (selectable batch-add) |
| 4 | **Players** | Player archetype CRUD (role, description, strategy), AI Generate Players panel, AI Enhance individual player profiles |
| 5 | **Rules Sandbox** | Full rules library, categorized (Core / Variant / Optional), priority drag-free ordering, AI Generate Rules, AI Enhance individual rules, Conflict Checker (AI-powered, JSON diff view), AI rules chat sandbox with message history |
| 6 | **Simulator** | Monte Carlo economy simulation (iterations, turns, gold income/spend with variance), P10/P50/P90 result bands (Recharts ComposedChart), Economy Health Score, simulation run history; AI Playthrough mode — full turn-by-turn narrative (SSE streaming, Claude) |
| 7 | **Assets** | Card asset list, AI card description generator (mechanical + flavor, SSE), AI image generation (OpenAI gpt-image-1), print sheet (browser native print) |
| 8 | **Playtesting** | Session log CRUD with notes, External Feedback Link (shareable public URL → `/feedback/:id`), playtest feedback viewer |
| 9 | **Tasks** | 4-column Kanban board (Backlog / In Progress / Review / Done), collapsible Changelog viewer |
| 10 | **Notes** | Sticky-note design board, pin notes, color-code, AI brainstorm (generates 6 notes), AI topic organizer, note → rule suggestion, persistent Design Chat (right panel, loads from DB) |
| 11 | **Storyboard** | Hierarchical branching design tree (parent/child nodes), node types (Rule Variant / Mechanic / Theme / Component / Event), status lifecycle (Idea → Exploring → Approved / Rejected), linked rule title, AI variant suggestions per node |
| 12 | **Balance** | Entity stat bar charts, property outlier detection, AI balance analysis, rule conflict checker |
| 13 | **Export** | Tabletop Simulator JSON export, Markdown rulebook export, printable rulebook, Kickstarter copy generator (SSE), printable Kickstarter pitch, Publisher Sell Sheet, Press Kit (BGG description, box copy, press release, social posts, reviewer pitch) |

### Design System

- **Color palette**: True black (`#000000`) background, `zinc-900`/`zinc-800` surface layers, cyan (`#06b6d4`) as primary accent
- **Dark mode**: Enforced via `class="dark"` on `<html>` element (Tailwind v4 `@custom-variant dark`)
- **Entity type colors**: Item = blue, Faction = purple, Location = green, Event = amber
- **Economy health colors**: Score >70 = emerald, 40–70 = amber, <40 = red
- **Typography**: System sans-serif stack, tab labels with underline active indicator
- **Animations**: SSE streaming text renders incrementally with no shimmer/placeholder

### Key Frontend Components

| Component | File | Purpose |
|---|---|---|
| `ChatTab` | `components/chat-tab.tsx` | Persistent design chat; loads/saves messages from DB; streaming SSE |
| `OverviewChat` | `components/overview-tab.tsx` | Collapsible AI Design Advisor; auto-opens when history exists |
| `SimulatorTab` | `components/simulator-tab.tsx` | Monte Carlo UI + AI Playthrough panel |
| `OntologyTab` | `components/ontology-tab.tsx` | Entity + property CRUD + SVG relationship map |
| `StoryboardTab` | `components/storyboard-tab.tsx` | Hierarchical idea tree + AI suggestions |
| `AdminPage` | `pages/admin.tsx` | User list, role toggle (admin/user), user removal |

---

## 4. Backend API

All routes are mounted under `/api`. The API server runs on port 8080 and is proxied by Replit's platform.

### Projects

| Method | Path | Description |
|---|---|---|
| GET | `/projects` | List all projects (name, genre, dates, forClient) |
| POST | `/projects` | Create project (name, description, genre, playerCount, targetDuration, forClient) |
| GET | `/projects/:id` | Full project with details |
| PATCH | `/projects/:id` | Update project fields |
| DELETE | `/projects/:id` | Delete project + cascade all child records |
| GET | `/projects/:id/stats` | Entity count, rule count, simulation count, asset count |

### Entities & Properties

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/entities` | List entities |
| POST | `/projects/:id/entities` | Create entity (name, type, description, color) |
| PATCH | `/projects/:id/entities/:id` | Update entity |
| DELETE | `/projects/:id/entities/:id` | Delete entity |
| GET | `/projects/:id/entities/:eid/properties` | List properties for entity |
| POST | `/projects/:id/entities/:eid/properties` | Create property (key, value) |
| PATCH | `/projects/:id/entities/:eid/properties/:pid` | Update property |
| DELETE | `/projects/:id/entities/:eid/properties/:pid` | Delete property |

### Rules

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/rules` | List rules (ordered by priority) |
| POST | `/projects/:id/rules` | Create rule |
| PATCH | `/projects/:id/rules/:id` | Update rule |
| DELETE | `/projects/:id/rules/:id` | Delete rule |
| POST | `/projects/:id/rules/:id/ai-enhance` | AI-rewrite single rule (SSE) |
| POST | `/projects/:id/rules-sandbox` | Run AI rules chat (SSE) |
| GET | `/projects/:id/rules-sandbox/history` | Get sandbox message history |
| DELETE | `/projects/:id/rules-sandbox/history` | Clear sandbox history |

### Notes

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/notes` | List notes |
| POST | `/projects/:id/notes` | Create note |
| PUT | `/projects/:id/notes/:nid` | Update note |
| DELETE | `/projects/:id/notes/:nid` | Delete note |
| POST | `/projects/:id/notes/ai-brainstorm` | Generate 6 AI design ideas as notes (streaming) |
| POST | `/projects/:id/notes/ai-organize-topics` | Categorize notes by topic (AI) |
| POST | `/projects/:id/notes/chat` | Design chat (SSE streaming, saves to project_chat_messages) |
| POST | `/projects/:id/notes/:nid/suggest-rule-changes` | AI rule-change suggestions from a note |

### Chat Message Persistence

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/chat/:type/messages` | Load chat history (type: "design" or "overview") |
| POST | `/projects/:id/chat/:type/messages` | Save a message |
| DELETE | `/projects/:id/chat/:type/messages` | Clear all messages of given type |

### Players

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/players` | List player archetypes |
| POST | `/projects/:id/players` | Create player |
| PATCH | `/projects/:id/players/:id` | Update player |
| DELETE | `/projects/:id/players/:id` | Delete player |
| POST | `/projects/:id/players/ai-generate` | AI-generate player archetypes (JSON) |
| POST | `/projects/:id/players/:id/ai-enhance` | AI-enhance a single player profile |

### Simulation

| Method | Path | Description |
|---|---|---|
| POST | `/projects/:id/simulate` | Run Monte Carlo economy simulation (no AI, pure math) |
| GET | `/projects/:id/simulation-history` | List past simulation runs |

### Analysis

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/balance-analysis` | AI balance analysis report (JSON) |
| GET | `/projects/:id/complexity-score` | 0-100 complexity score (AI) |
| POST | `/projects/:id/rules/check-conflicts` | AI conflict checker (JSON diff) |
| POST | `/projects/:id/press-kit/generate` | AI press kit generator (SSE) |
| POST | `/projects/:id/publisher-pitch/generate` | AI sell sheet generator (SSE) |
| GET | `/projects/:id/publisher-pitch-print` | Printable HTML sell sheet |
| POST | `/projects/:id/simulate-playthrough` | AI turn-by-turn playthrough narrative (SSE, Claude) |
| GET | `/projects/:id/changelog` | Project changelog entries |

### Game Setup / Blueprint

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/files` | List uploaded reference files |
| POST | `/projects/:id/files/upload` | Upload PDF or TXT (multer) |
| POST | `/projects/:id/files/fetch-url` | Fetch and parse external URL |
| DELETE | `/projects/:id/files/:fid` | Delete file |
| POST | `/projects/:id/analyze-and-build` | Full AI blueprint extraction (SSE) — generates entities + rules + players from uploaded material |
| POST | `/projects/:id/populate-from-blueprint` | Persist AI blueprint output to DB |
| POST | `/projects/:id/ai-generate-entities` | AI-only entity generation |
| POST | `/projects/:id/ai-generate-rules` | AI-only rule generation |

### Assets

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/assets` | List assets |
| POST | `/projects/:id/assets` | Create asset record |
| DELETE | `/projects/:id/assets/:id` | Delete asset |
| POST | `/projects/:id/generate-card-description` | AI card description (mechanical + flavor, SSE) |
| POST | `/projects/:id/generate-asset-image` | OpenAI image generation (gpt-image-1) |

### Research

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/research-items` | List research items |
| POST | `/projects/:id/research-items` | Create item |
| DELETE | `/projects/:id/research-items/:id` | Delete item |
| POST | `/projects/:id/research-items/fetch-url` | URL scrape + save |
| POST | `/projects/:id/research/chat` | Research AI chat |
| POST | `/projects/:id/description/ai-enhance` | Enhance project description (AI) |
| GET | `/projects/:id/rulebook-print` | Printable HTML rulebook |
| POST | `/projects/:id/analyze-and-build-with-research` | Blueprint extraction that also incorporates research items |

### Storyboard

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/storyboard-nodes` | List nodes (full tree) |
| POST | `/projects/:id/storyboard-nodes` | Create node |
| PUT | `/projects/:id/storyboard-nodes/:nid` | Update node (status, content, etc.) |
| DELETE | `/projects/:id/storyboard-nodes/:nid` | Delete node |
| POST | `/projects/:id/storyboard-nodes/:nid/ai-suggest` | AI suggests child variants for a node |

### Export

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/export/tabletop-simulator` | Tabletop Simulator JSON format |
| GET | `/projects/:id/export/rulebook` | Markdown rulebook |

### Kickstarter

| Method | Path | Description |
|---|---|---|
| POST | `/projects/:id/kickstarter/generate` | AI Kickstarter campaign copy (SSE) |
| GET | `/projects/:id/kickstarter-print` | Printable HTML Kickstarter pitch |

### Playtesting

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/playtest-sessions` | List sessions |
| POST | `/projects/:id/playtest-sessions` | Create session |
| DELETE | `/projects/:id/playtest-sessions/:id` | Delete session |

### Tasks

| Method | Path | Description |
|---|---|---|
| GET | `/projects/:id/tasks` | List collab tasks |
| POST | `/projects/:id/tasks` | Create task |
| PATCH | `/projects/:id/tasks/:id` | Update task (status, description) |
| DELETE | `/projects/:id/tasks/:id` | Delete task |

### Account

| Method | Path | Description |
|---|---|---|
| GET | `/account/settings` | Load user's AI provider preference |
| PUT | `/account/settings` | Save provider, model, API key |

### Admin

| Method | Path | Auth |
|---|---|---|
| GET | `/admin/users` | List all app users | Admin role only |
| PUT | `/admin/users/:clerkId/role` | Change user role (user/admin) | Admin role only |
| DELETE | `/admin/users/:clerkId` | Remove user from system | Admin role only |

---

## 5. Database Schema

All tables use PostgreSQL via Drizzle ORM. Migrations are managed in `lib/db/drizzle/`. All timestamps are `timestamp with time zone`.

### `projects`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| name | text NOT NULL | |
| description | text | |
| genre | text | |
| player_count | text | |
| target_duration | text | |
| for_client | text | Optional studio/client attribution |
| created_at | timestamptz | |
| updated_at | timestamptz | `$onUpdate` |

### `entities`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| name | text NOT NULL | |
| type | text NOT NULL | Item / Faction / Location / Event |
| description | text | |
| color | text | |
| created_at / updated_at | timestamptz | |

### `properties`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | |
| entity_id | integer FK → entities | CASCADE delete |
| key | text NOT NULL | Stat/attribute name |
| value | text NOT NULL | |
| created_at / updated_at | timestamptz | |

### `rules`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| title | text NOT NULL | |
| content | text NOT NULL | Full rule text |
| category | text | Core / Variant / Optional |
| priority | integer | Default 0 |
| created_at / updated_at | timestamptz | |

### `simulations`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| label | text | Run name |
| config | jsonb NOT NULL | Input parameters snapshot |
| percentile_10 | real NOT NULL | P10 final gold |
| percentile_50 | real NOT NULL | P50 (median) |
| percentile_90 | real NOT NULL | P90 |
| mean | real NOT NULL | |
| std_dev | real NOT NULL | |
| economy_health_score | real NOT NULL | 0-100 |
| turn_data | jsonb NOT NULL | Array of per-turn statistics |
| created_at | timestamptz | |

### `assets`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| name | text | |
| type | text | card / token / board |
| description | text | AI-generated mechanical description |
| flavor_text | text | AI-generated flavor text |
| image_url | text | gpt-image-1 result URL |
| created_at / updated_at | timestamptz | |

### `notes`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| title | text | |
| content | text | |
| color | text | slate / blue / purple / amber / emerald |
| pinned | boolean | |
| topic | text | AI-organized category |
| look_at_later | boolean | |
| created_at / updated_at | timestamptz | |

### `project_chat_messages`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| user_id | text | Clerk userId (nullable for assistant messages) |
| chat_type | text | "design" or "overview" |
| role | text | "user" or "assistant" |
| content | text NOT NULL | Message body |
| created_at | timestamptz | |

### `storyboard_nodes`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| parent_id | integer | Self-reference for tree |
| title | text NOT NULL | |
| content | text | |
| status | text | idea / exploring / approved / rejected |
| type | text | rule_variant / mechanic / theme / component / event |
| linked_rule_title | text | Optional link to a rule |
| color | text | |
| position | integer | Sort order |
| created_at / updated_at | timestamptz | |

### `players`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| name | text NOT NULL | |
| role | text | |
| description | text | |
| strategy | text | |
| created_at / updated_at | timestamptz | |

### `collab_tasks`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| title | text NOT NULL | |
| description | text | |
| status | text | backlog / in_progress / review / done |
| created_at / updated_at | timestamptz | |

### `playtest_sessions`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| label | text | |
| notes | text | |
| player_count | integer | |
| duration_minutes | integer | |
| created_at | timestamptz | |

### `playtest_feedback`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| session_id | integer FK → playtest_sessions | |
| rating | integer | 1-5 |
| comment | text | |
| created_at | timestamptz | |

### `project_files`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| filename | text NOT NULL | |
| original_name | text | |
| source_url | text | For URL-fetched content |
| content | text | Extracted plain text |
| file_type | text | pdf / txt / url |
| created_at | timestamptz | |

### `research_items`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| title | text | |
| url | text | |
| content | text | Scraped or manually entered content |
| created_at | timestamptz | |

### `change_log`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| project_id | integer FK → projects | CASCADE delete |
| description | text NOT NULL | What changed |
| created_at | timestamptz | |

### `user_settings`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| user_id | text UNIQUE | Clerk userId |
| provider | text | anthropic / openai / gemini / xai |
| model | text | e.g. gpt-4o-mini |
| anthropic_api_key | text | Encrypted at rest (Postgres) |
| openai_api_key | text | |
| gemini_api_key | text | |
| xai_api_key | text | |
| created_at / updated_at | timestamptz | |

### `app_users`

| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| clerk_id | text UNIQUE | Clerk userId |
| email | text NOT NULL | |
| first_name | text | |
| last_name | text | |
| role | text | "user" (default) or "admin" |
| created_at / updated_at | timestamptz | |

### `conversations` / `messages`

Legacy direct-conversation tables (Anthropic + OpenAI conversation threads), separate from the newer `project_chat_messages` design. These back the `/anthropic/conversations` and `/openai/conversations` routes.

### `sandbox_messages`

Stores the AI rules-sandbox chat history (the conversational Rules Sandbox).

---

## 6. AI System

### Routing Decision

Every AI call in the system is routed through one of two functions in `artifacts/api-server/src/lib/ai-provider.ts`:

| Function | When to use | Default model | Auth required |
|---|---|---|---|
| `getNarrativeAIConfig()` | Creative/narrative output — design advisor, playthrough narration, storyboard suggestions | Claude Haiku 4.5 | `ANTHROPIC_API_KEY` env var |
| `getUserAIConfig(userId)` | Analytical/structured output — balance analysis, rules, entities, conflict detection | GPT-4o Mini (OpenAI Replit integration) | Per-user DB setting, fallback to Replit OpenAI integration |

**Narrative routes (always Claude)**
- Overview AI Design Advisor (`/overview/chat`)
- AI Playthrough Narrator (`/simulate-playthrough`)
- Storyboard AI suggestions (`/storyboard-nodes/:id/ai-suggest`)

**Analytical routes (user-configurable, default OpenAI)**
- Balance analysis, complexity score
- Entity generation, rule generation, player generation
- Conflict checker, rule AI-enhance
- Card description generator
- Press kit / publisher pitch
- Research chat, design notes chat
- Kickstarter copy generator

### Streaming

All AI routes that produce long text use SSE (Server-Sent Events) via `streamAI()`. The SSE wire format is `data: {text: "chunk"}` for Anthropic (forwarded as `{"content": "..."}` from routes) and standard OpenAI streaming chunks.

### Image Generation

`POST /projects/:id/generate-asset-image` calls OpenAI's `gpt-image-1` model. Images are returned as base64 and stored as a URL in the `assets` table. The OpenAI client uses the Replit AI Integration key (`AI_INTEGRATIONS_OPENAI_API_KEY`).

### Supported AI Providers

| Provider | SDK | Auth method | Models |
|---|---|---|---|
| Anthropic | `@anthropic-ai/sdk` | `ANTHROPIC_API_KEY` env | claude-haiku-4-5, claude-sonnet-4-6, claude-opus-4-7 |
| OpenAI | `openai` | Replit Integration key or user key | gpt-4o-mini, gpt-4o |
| Google Gemini | `openai` (baseURL override) | User-provided key | gemini-2.0-flash, gemini-2.5-pro |
| xAI Grok | `openai` (baseURL override) | User-provided key | grok-3-mini, grok-3 |

### Per-User AI Preference

Users can configure their own AI provider + model + API key in `/account`. Settings are stored in `user_settings`. If a user has no saved settings or an invalid key, the system falls back to the Replit OpenAI Integration.

---

## 7. Authentication & User Management

### Authentication Provider: Clerk

- Frontend: `<ClerkProvider>` wraps the entire app. Sign-in/sign-up use Clerk's hosted UI at `/sign-in` and `/sign-up`.
- Backend: `clerkMiddleware()` from `@clerk/express` is applied globally. Auth is read from `(req as any).auth?.userId`.
- Routes that require auth check for a valid `userId`. Public routes (e.g., feedback form, healthz) skip auth.

### User Auto-Sync Middleware

On every authenticated API request, `app.ts` runs a middleware that:
1. Reads `userId` from Clerk session
2. Calls `clerkClient.users.getUser(userId)` to get the user's email, firstName, lastName
3. `db.insert(appUsersTable).values(...).onConflictDoUpdate(...)` — upserts the user into `app_users`

This ensures the local user table stays synchronized with Clerk without requiring webhooks.

### Role System

| Role | Access |
|---|---|
| `user` | All project features |
| `admin` | All user features + `/admin` panel (view/modify users) |

The first admin must be set directly in the database. All subsequent role changes can be made through the admin panel.

### Protected Routes (Frontend)

`ProtectedWorkspace` and `ProtectedAccount` are wrapper components that check Clerk's `isSignedIn`. If false, they redirect to `/sign-in`.

The `/admin` route renders `AdminPage` which calls the API; if the user is not an admin, the backend returns 403 and the UI shows an access-denied message.

---

## 8. Key Data Flows

### 1. Create a Project

```
Dashboard → "New Project" dialog
  → POST /api/projects (name, genre, forClient, description)
  → DB insert → returns project row
  → React Query invalidates useListProjects
  → Navigate to /projects/:id
```

### 2. AI Blueprint Extraction

```
Overview tab → Upload PDF or paste URL
  → POST /files/upload (multer saves file, pdf-parse extracts text)
  OR
  → POST /files/fetch-url (fetch HTML, strip to text)
  → POST /analyze-and-build (SSE)
    → AI reads all project files + existing entities/rules
    → Streams structured JSON blueprint (entities, rules, players)
  → POST /populate-from-blueprint
    → DB bulk-inserts entities, rules, players
    → React Query invalidates all lists
```

### 3. Design Chat (Notes tab)

```
User types in ChatTab
  → POST /projects/:id/notes/chat (SSE)
    → getNarrativeAIConfig() → Claude
    → Reads all notes + entities + rules as context
    → Streams assistant response
    → Saves user + assistant messages to project_chat_messages (chatType = "design")
  → On next mount: GET /projects/:id/chat/design/messages → loads history
  → "New chat" → DELETE /projects/:id/chat/design/messages
```

### 4. Monte Carlo Simulation

```
Simulator tab → Configure (iterations, turns, goldPerTurn, spendVariance, etc.)
  → POST /projects/:id/simulate (useRunSimulation mutation)
    → runMonteCarlo() (pure TypeScript, no AI)
    → DB insert to simulations table
    → Returns P10/P50/P90, healthScore, turnData
  → Recharts ComposedChart renders results
  → useListSimulations hook refetches history
```

### 5. AI Playthrough

```
Simulator tab → AI Playthrough mode → "Run Playthrough" button
  → fetch POST /projects/:id/simulate-playthrough (SSE)
    → getNarrativeAIConfig() → Claude
    → Reads entities, rules, players, recent simulation stats
    → Streams turn-by-turn narrative text
  → Text renders incrementally in prose panel
```

### 6. Asset Image Generation

```
Assets tab → Select entity → "Generate Image"
  → POST /projects/:id/generate-asset-image
    → OpenAI gpt-image-1 (DALL-E 3) with entity description prompt
    → Returns base64 image URL
    → DB saves to assets table
  → Image renders in asset card
```

---

## 9. Monorepo Package Structure

```
/
├── artifacts/
│   ├── api-server/          # Express API (port 8080)
│   │   ├── src/
│   │   │   ├── app.ts       # Express setup, Clerk middleware, user-sync middleware
│   │   │   ├── index.ts     # Entry point (port binding, migrations)
│   │   │   ├── lib/
│   │   │   │   └── ai-provider.ts   # AI routing, provider abstraction
│   │   │   └── routes/      # One file per domain (23 route files)
│   │   └── build.mjs        # esbuild config (externalizes pdf-parse)
│   │
│   └── board-game-factory/  # React + Vite frontend
│       └── src/
│           ├── App.tsx       # Routing, Clerk setup
│           ├── pages/        # Dashboard, ProjectWorkspace, Admin, Account, Feedback…
│           └── components/   # Tab components, UI primitives
│
├── lib/
│   ├── db/                  # Drizzle ORM schemas + migrations
│   │   ├── src/schema/      # 20 table definition files
│   │   └── drizzle/         # Migration SQL files (0000, 0001, 0002)
│   │
│   ├── api-spec/            # openapi.yaml (source of truth for typed client)
│   ├── api-client-react/    # Orval-generated React Query hooks (useGetProject, etc.)
│   ├── api-zod/             # Orval-generated Zod validation schemas
│   ├── integrations-anthropic-ai/      # Anthropic client wrapper
│   └── integrations-openai-ai-server/  # OpenAI client + image gen wrapper
│
├── pnpm-workspace.yaml
├── tsconfig.base.json       # Shared TS config (strict, module ESNext)
└── replit.md                # Architecture memory (read by AI on every session)
```

---

## 10. Environment & Configuration

### Required Environment Variables

| Variable | Used By | Description |
|---|---|---|
| `DATABASE_URL` | API server | PostgreSQL connection string |
| `ANTHROPIC_API_KEY` | API server | Claude — narrative AI + fallback |
| `AI_INTEGRATIONS_OPENAI_API_KEY` | API server | OpenAI via Replit AI Integration |
| `AI_INTEGRATIONS_OPENAI_BASE_URL` | API server | Replit proxy base URL for OpenAI |
| `SESSION_SECRET` | API server | Express session signing |
| `CLERK_SECRET_KEY` | API server | Clerk backend verification |
| `VITE_CLERK_PUBLISHABLE_KEY` | Frontend | Clerk frontend initialization |
| `PORT` | Both | Port assigned by Replit proxy (each artifact gets a unique port) |

### Secrets Management

All secrets are stored and injected via Replit's secret manager. They are never written to source files or `.env` files in the repository. The `ANTHROPIC_API_KEY` and `SESSION_SECRET` are configured as Replit secrets. The OpenAI integration variables are injected automatically by the Replit AI Integrations system.

---

## 11. Build & Deployment

### Development

```bash
# Start API server (builds then runs)
pnpm --filter @workspace/api-server run dev

# Start frontend (Vite HMR)
pnpm --filter @workspace/board-game-factory run dev

# Run DB migrations
pnpm --filter @workspace/db run migrate

# Force-push schema (destructive, dev only)
pnpm --filter @workspace/db run push

# Regenerate typed API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Rebuild db declarations (after schema changes)
cd lib/db && pnpm exec tsc -p tsconfig.json
```

### API Server Build

The API server is built with esbuild (`build.mjs`). Key configuration:
- Output: `dist/index.mjs` (ESM)
- `pdf-parse` is externalized (uses native Node.js `require`, loaded via `createRequire`)
- Source maps enabled for debugging
- Bundles all workspace packages inline

### Database Migrations

Drizzle Kit manages migrations:
- Migration files live in `lib/db/drizzle/`
- Current migrations: `0000_initial.sql`, `0001_simulations.sql`, `0002_extensions.sql`
- `0002_extensions.sql` adds: `for_client` column on projects, `project_chat_messages` table, `app_users` table
- The API server runs `migrate()` automatically on every startup (`index.ts`)

### Deployment

The project deploys via Replit's publishing system:
- Frontend artifact: `artifacts/board-game-factory` (served at `/`)
- API artifact: `artifacts/api-server` (served at `/api`)
- Both artifacts run as persistent processes via Replit Workflows
- Production PostgreSQL is a separate Replit-provisioned database instance
- All environment secrets are configured separately for production in the Replit Deployments panel
