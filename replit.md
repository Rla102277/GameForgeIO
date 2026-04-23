# AI Board Game Factory

A professional dark-mode developer tool platform for board game designers. Build complete board game systems using AI assistance, economic simulation, and structured ontologies.

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
  - New: players, collab_tasks, project_files, playtest_sessions, change_log
- **`lib/api-spec`** — OpenAPI spec (`openapi.yaml`) with codegen script
- **`lib/api-client-react`** — Orval-generated React Query hooks
- **`lib/api-zod`** — Orval-generated Zod validation schemas
- **`lib/integrations-anthropic-ai`** — Anthropic AI client
- **`lib/integrations-openai-ai-server`** — OpenAI client + image generation

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
