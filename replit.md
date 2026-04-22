# AI Board Game Factory

A professional dark-mode developer tool platform for board game designers. Build complete board game systems using AI assistance, economic simulation, and structured ontologies.

## Architecture

**Monorepo (pnpm workspace)** with the following packages:

### Artifacts

- **`artifacts/api-server`** — Express API server (port 8080, proxy at `/api`)
  - Routes: projects, entities, properties, rules, simulation, assets, export, anthropic, openai
  - Anthropic (Claude Sonnet) for Rules Sandbox SSE streaming
  - Anthropic (Claude Haiku) for card description generation SSE streaming
  - OpenAI (gpt-image-1) for asset image generation
  - Monte Carlo economic simulation engine

- **`artifacts/board-game-factory`** — React + Vite frontend (dark mode, Tailwind v4 + Shadcn UI)
  - Dashboard: project cards with genre/date metadata
  - Project Workspace with 5 tabs:
    - **Ontology**: Entity builder (Item/Faction/Location/Event) with color-coded badges + property management
    - **Rules**: Rules library + AI Rules Sandbox (Anthropic SSE chat with full project context)
    - **Simulator**: Monte Carlo economy simulation with Recharts P10/P50/P90 confidence bands
    - **Assets**: AI card description (SSE) + OpenAI image generation
    - **Export**: Tabletop Simulator JSON + Markdown rulebook

### Shared Libraries

- **`lib/db`** — Drizzle ORM + PostgreSQL schema (projects, entities, properties, rules, sandbox_messages, simulations, assets, conversations, messages)
- **`lib/api-spec`** — OpenAPI spec (`openapi.yaml`) with codegen script
- **`lib/api-client-react`** — Orval-generated React Query hooks
- **`lib/api-zod`** — Orval-generated Zod validation schemas
- **`lib/integrations-anthropic-ai`** — Anthropic AI client
- **`lib/integrations-openai-ai-server`** — OpenAI client + image generation

## Key Design Decisions

- Dark mode enforced via `class="dark"` on `<html>` element (Tailwind v4 `@custom-variant dark`)
- Entity types color-coded: Item=blue, Faction=purple, Location=green, Event=amber
- Economy health score: >70=emerald, 40-70=amber, <40=red
- SSE streaming for all AI responses (Rules Sandbox, card descriptions)
- React Query cache invalidation via `queryClient.invalidateQueries` on all mutations
- AI routing: Anthropic claude-sonnet-4-6 (rules sandbox), claude-haiku-4-5 (card descriptions), OpenAI gpt-image-1 (images)

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
```
