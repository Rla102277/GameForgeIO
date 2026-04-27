# AI Board Game Factory

A professional dark-mode developer tool platform for board game designers. Build complete board game systems using AI assistance, economic simulation, and structured ontologies.

**GitHub:** https://github.com/Rla102277/GameForgeIO (main branch — all commits synced)

## Architecture

**Monorepo (pnpm workspace)** with the following packages:

### Artifacts

- **`artifacts/api-server`** — Express API server (port 8080, proxy at `/api`)
  - Routes: projects, entities, properties, rules, simulation, assets, export, anthropic, openai
  - New routes: game-setup (file upload + AI blueprint), players (CRUD + AI), collab-tasks (kanban), playtest (sessions)
  - Analysis routes (analysis.ts): balance-analysis, complexity-score, rules/check-conflicts, press-kit/generate, publisher-pitch/generate, publisher-pitch-print, simulate-playthrough, changelog, playtest-feedback CRUD
  - AI routing: Claude Sonnet 4.6 for blueprint SSE streaming, Claude Haiku 4.5 for entity/rule/player JSON generation
  - OpenAI gpt-image-1 for asset image generation
  - Monte Carlo economic simulation engine
  - multer for PDF/TXT file upload, createRequire("pdf-parse") for text extraction (externalized in esbuild)

- **`artifacts/board-game-factory`** — React + Vite frontend (dark mode, Tailwind v4 + Shadcn UI)
  - Dashboard: project cards with genre/date metadata
  - Project Workspace with **11 tabs** (underline-style active indicator):
    - **Overview**: Game info editor, Complexity Score widget (0-100 BGG-style), PDF/TXT upload, URL fetch, AI Game Architect blueprint (SSE)
    - **Research**: Research item CRUD
    - **Ontology**: Entity builder (Item/Faction/Location/Event) + AI Generate Entities + SVG Relationship Map (radial, auto-detects links from descriptions)
    - **Players**: Player archetype builder + AI Generate Players panel
    - **Rules Sandbox**: Rules library + Variant/Optional category + AI Generate Rules + Conflict Checker (Anthropic Haiku) + AI chat
    - **Simulator**: Monte Carlo economy simulation (Recharts P10/P50/P90) + AI Playthrough mode (full turn narrative, SSE)
    - **Assets**: AI card description (SSE) + OpenAI image generation + Print Sheet (browser print)
    - **Playtesting**: Session log + External Feedback Link (shareable URL) + Feedback response viewer
    - **Tasks**: 4-column Kanban board + collapsible Changelog viewer
    - **Balance**: Entity stat bar charts, rule conflict checker, balance score display
    - **Export**: Tabletop Simulator JSON + Markdown rulebook + Kickstarter generator + Publisher Sell Sheet + Press Kit generator (BGG desc, box copy, press release, social posts, reviewer pitch)

### Shared Libraries

- **`lib/db`** — Drizzle ORM + PostgreSQL schema
  - Core: projects, entities, properties, rules, sandbox_messages, simulations, assets, conversations, messages
  - New: players, collab_tasks, project_files, playtest_sessions, change_log, research_items, playtest_feedback, notes, storyboard_nodes, user_settings
  - Latest: `project_chat_messages` (persists design/overview chat), `app_users` (user provisioning with roles)
  - `projects.for_client` — optional client/studio attribution slug field
- **`lib/api-spec`** — OpenAPI spec (`openapi.yaml`) with codegen script
- **`lib/api-client-react`** — Orval-generated React Query hooks
- **`lib/api-zod`** — Orval-generated Zod validation schemas
- **`lib/integrations-anthropic-ai`** — Anthropic AI client
- **`lib/integrations-openai-ai-server`** — OpenAI client + image generation

## Multi-Provider AI System

- **`artifacts/api-server/src/lib/ai-provider.ts`** — Unified AI provider abstraction
  - `getNarrativeAIConfig()` — Always uses Claude (Anthropic) for narrative/creative tasks (overview chat, storyboard, simulate-playthrough)
  - `getUserAIConfig(userId)` — Loads user's preferred provider/model/key from DB; falls back to OpenAI via Replit AI Integration
  - `streamAI(config, messages, onChunk, options)` — Universal streaming (Anthropic SDK natively; Gemini/xAI/OpenAI via OpenAI SDK with baseURL)
  - `callAI(config, messages, options)` — Non-streaming AI call
  - Supported providers: anthropic (claude-haiku-4-5, sonnet-4-6, opus-4-7), gemini (2.0-flash, 2.5-pro), openai (gpt-4o-mini, gpt-4o), xai (grok-3-mini, grok-3)
  - **AI routing rule**: narrative/overview = always Claude; analytical/technical = user's configured provider (default OpenAI)
- All AI routes updated to use `getUserAIConfig + streamAI/callAI` (game-setup, rules, players, notes, analysis, research, storyboard, kickstarter, overview-chat)
- **`lib/db/src/schema/user_settings.ts`** — `user_settings` table (userId, provider, model, 4 API key fields)

## Chat Persistence

- Design chat (notes.ts) and Overview chat (overview-tab) messages persisted to `project_chat_messages` table
- New routes: `GET/POST/DELETE /api/projects/:id/chat/:type/messages` (type: "design" | "overview")
- Frontend chat-tab and overview-tab load history on mount, support clearing from DB
- `chat_type` column distinguishes design vs overview conversations

## User Provisioning & Admin

- **`lib/db/src/schema/app_users.ts`** — `app_users` table: clerkId, email, firstName, lastName, role ("user"|"admin"), timestamps
- User auto-sync middleware in `app.ts`: on every authenticated request, upserts user into `app_users` via Clerk API
- **Admin page** at `/admin` — User management panel (view all users, toggle admin role, remove users)
- Admin routes: `GET/PUT/DELETE /api/admin/users` — protected, requires `role === "admin"` in app_users

## Account Page

- Route: `/account` (protected, requires sign-in)
- Profile header (Clerk user info, project count)
- AI Provider cards: 4 providers with model selector and API key input
- GET/PUT `/api/account/settings` — reads/writes user's AI preferences

## Key Design Decisions

- Dark mode enforced via `class="dark"` on `<html>` element (Tailwind v4 `@custom-variant dark`)
- Entity types color-coded: Item=blue, Faction=purple, Location=green, Event=amber
- Economy health score: >70=emerald, 40-70=amber, <40=red
- SSE streaming for AI blueprint analysis and Rules Sandbox
- React Query cache invalidation via `queryClient.invalidateQueries` on all mutations
- New feature routes are NOT in OpenAPI spec — frontend uses `fetch()` directly to `/api`
- pdf-parse externalized in esbuild (`build.mjs`) to avoid DOMMatrix browser-API crash; loaded via `createRequire`
- AI Generate panels: all open/close as toggleable panels within the tab, show selectable list of AI-generated items, batch-add selected items

## Environment

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned)
- `SESSION_SECRET` — Session secret
- Anthropic and OpenAI AI integrations provisioned via Replit

## Development

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/board-game-factory run dev

# Run DB migrations
pnpm --filter @workspace/db run push

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Build API server (uses build.mjs / esbuild)
pnpm --filter @workspace/api-server run build
```
