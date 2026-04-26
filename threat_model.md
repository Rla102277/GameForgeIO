# Threat Model

## Project Overview

AI Board Game Factory is a pnpm monorepo that serves a production React + Vite web app (`artifacts/board-game-factory`) backed by an Express API (`artifacts/api-server`) and PostgreSQL via Drizzle (`lib/db`). Users create and manage board-game design projects containing notes, rules, entities, research, playtest data, exports, and AI-generated content. Authentication is provided by Clerk; admin actions are implemented through a local `app_users` role table.

Production assumptions for this scan: `NODE_ENV=production`, platform TLS is handled by Replit, and `artifacts/mockup-sandbox` is dev-only unless production reachability is demonstrated.

## Assets

- **Project data and design IP** — project metadata, entities, rules, notes, assets, research items, storyboard nodes, exported documents, playtest sessions, and feedback. This is the product’s core business data and may contain unreleased game concepts or client work.
- **User-linked settings and secrets** — Clerk identities, local roles in `app_users`, and user-supplied AI provider API keys in `user_settings`.
- **Shared AI conversation history and provider spend** — the `/api/openai/*` and `/api/anthropic/*` routes expose stored prompts, model outputs, and server-billed AI/image generation capacity.
- **Admin capabilities** — the ability to list users, change roles, and remove users through `/api/admin/*`.
- **Server-side network reachability** — the API server can make outbound requests to third-party AI providers and user-supplied URLs, so it can become a pivot into internal or privileged network locations if fetches are not constrained.
- **Application integrity and availability** — long-running AI/SSE endpoints, file uploads, and HTML export routes affect service stability and the trustworthiness of generated outputs.

## Trust Boundaries

- **Browser to API** — all client input crosses from an untrusted browser into `/api`. Route protection must be enforced server-side; frontend-only checks are not security controls.
- **Public vs authenticated vs admin surfaces** — the app mixes public pages (`/feedback/:id`, `/changelog`), authenticated user workflows (`/projects/:id`, `/account`), shared AI proxy routes (`/api/openai/*`, `/api/anthropic/*`), and admin-only operations (`/api/admin/*`). These boundaries must remain explicit and enforced on the backend.
- **API to PostgreSQL** — the API has direct read/write access to all project data, roles, user settings, and shared AI conversations. Access control failures at the route layer expose the entire dataset.
- **API to external services** — the server calls Clerk, Anthropic, OpenAI-compatible providers, and user-supplied URLs. Untrusted destinations must not gain access to internal network paths or secrets.
- **Stored content to browser rendering** — notes, chat messages, project descriptions, rules, and export content are persisted server-side and later rendered in React or raw HTML responses. Stored content must be treated as untrusted at render time.

## Scan Anchors

- **Production entry points**: `artifacts/api-server/src/index.ts`, `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/*`, `artifacts/board-game-factory/src/App.tsx`
- **Highest-risk areas**: project-scoped API routes in `artifacts/api-server/src/routes/*`, shared AI proxy routes in `artifacts/api-server/src/routes/openai-routes.ts` and `artifacts/api-server/src/routes/anthropic-routes.ts`, auth/admin logic in `app.ts`, `account.ts`, and `admin.ts`, server-side URL fetch in `game-setup.ts` and `research.ts`, and rendering sinks in chat/export pages
- **Public surfaces**: `/feedback/:id`, `/changelog`, any unauthenticated `/api/projects/*` route proven reachable, and any shared AI proxy route lacking server-side auth
- **Dev-only areas**: `artifacts/mockup-sandbox`, `scripts`, `docs`, codegen/config-only files unless linked into runtime

## Threat Categories

### Spoofing

Clerk provides identity, but the application must treat `req.auth` as mandatory on all protected endpoints and must not rely on frontend route guards alone. Admin decisions must be derived from trusted backend data in `app_users`, and project access must be bound to the authenticated user rather than to guessable project IDs.

Required guarantees:
- All non-public project APIs MUST require a valid authenticated user.
- Shared AI proxy APIs MUST require a valid authenticated user and must not expose global conversations across accounts.
- Admin APIs MUST verify admin role server-side on every request.
- Project access decisions MUST be based on authenticated ownership or an explicit sharing model, not on possession of a numeric ID.

### Tampering

Users can create and modify rich project content, and the server also accepts AI-generated data and fetched external content. Attackers must not be able to alter another user’s project, inject unauthorized chat/history entries, or use external-fetch features to mutate stored data for projects they do not control.

Required guarantees:
- Every write endpoint under `/api/projects/:id/*` MUST verify that the caller is authorized for that project.
- Object identifiers in nested routes MUST be scoped to the parent project and authorized user.
- Public feedback submission endpoints MUST be narrowly scoped to the intended public fields only.
- Shared AI conversations and messages MUST be scoped to an owning user or tenant before read, append, or delete operations are allowed.

### Information Disclosure

The platform stores private design documents, playtest notes, research, exports, user-linked settings, and shared AI conversation history. Unauthorized reads of project-scoped routes, printable exports, chat history, or AI conversations would expose customer IP and sensitive prompts.

Required guarantees:
- Project reads and export/document routes MUST enforce the same authorization policy as core project CRUD routes.
- API responses MUST return only the data needed for the calling user and route.
- Secrets and user-provided API keys MUST never be exposed to other users, logs, or client code.
- Shared AI conversation history MUST never be globally enumerable by unauthenticated or unrelated users.

### Denial of Service

The API exposes file upload, SSE/streaming AI endpoints, document generation, and server-side URL fetches. Attackers could abuse these for resource exhaustion or stuck outbound requests if limits are missing or too permissive.

Required guarantees:
- Public or low-friction routes MUST enforce practical limits on request size, concurrency, and expensive operations.
- File uploads and URL fetches MUST be bounded by size, timeouts, and allowed content expectations.
- Streaming and AI-backed routes MUST not be freely triggerable by unauthenticated attackers.

### Elevation of Privilege

The main privilege transition is from unauthenticated or regular-user access to other users’ projects, shared AI history, or admin-only functionality. The biggest risks are broken object-level authorization across project routes, unauthenticated access to shared paid AI endpoints, and injection issues that turn stored content into script execution in privileged browser sessions.

Required guarantees:
- The server MUST enforce per-project authorization on every project-scoped route.
- Stored user-controlled content MUST be safely encoded or sanitized before insertion into HTML or `dangerouslySetInnerHTML` sinks.
- Server-side fetch features MUST validate destinations so they cannot be used for SSRF against internal services.
- User offboarding and admin revocation semantics MUST persist across restarts and across instances rather than relying on transient in-memory state.