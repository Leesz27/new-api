# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Mandatory Instructions

Before planning, coding, reviewing, or answering a project question, read the repository-root `AGENTS.md` in full with the Read tool. Do this first for every new task; do not rely on imports, summaries, memory, grep, or a previous turn. Its rules cover database compatibility, relay DTOs, billing safety, authentication, tests, frontend reuse, i18n, and project governance.

For any task touching `web/`, also read `web/AGENTS.md` before editing frontend files.

## Development Commands

The root Go module requires Go 1.25.1. The frontend uses Bun. The application embeds `web/dist`, so a clean root build/test may require building the frontend first.

```bash
# Full local stack: Docker API/PostgreSQL plus frontend on :5173
make dev

# API services only, or rebuild the API container
make dev-api
make dev-api-rebuild

# Frontend dev server only
make dev-web

# Run the backend directly after web/dist exists
make build-web
go run main.go

# Production frontend build and combined app startup
make all
```

Testing and checks:

```bash
# Root module plus independently built relaykit module
make test

# Root Go tests (use GOWORK=off when checking module boundaries)
go test ./...

# One Go package or one named test
go test ./controller
go test ./controller -run '^TestName$'

# relaykit must remain independently buildable/testable
cd relaykit && GOWORK=off go build ./...
cd relaykit && GOWORK=off go test ./...

# Frontend checks (run from web/)
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build:check

# One frontend test file or module
bun run test -- src/features/playground/hooks/use-stream-request.test.ts
bun run test -- src/features/playground
```

Use `bun install --frozen-lockfile` for reproducible frontend installs. `make reset-setup` clears the local setup wizard state from the Docker PostgreSQL database or configured SQLite database.

## Architecture

This is a Gin/GORM AI gateway with a React administration UI. The backend follows `router -> middleware/controller -> service -> model`, while relay requests add a provider-adapter pipeline.

- `main.go` initializes databases, caches, settings, scheduled jobs, and the Gin server. It embeds the compiled frontend from `web/dist`.
- `router/` separates management APIs (`/api`) from model relay APIs (`/v1`, `/v1beta`, task routes, and authenticated `/pg` Playground routes). Middleware ordering here is part of authentication, request-body, routing, and billing behavior.
- `controller/` owns HTTP handlers and response shaping. Business workflows belong in `service/`; persistent data and GORM queries belong in `model/`.
- `middleware/distributor.go` selects a channel using model, group, endpoint, and retry context before handing requests to `controller.Relay`.
- `relay/` orchestrates format detection, validation, conversion, provider dispatch, streaming, usage accounting, and settlement. `relay/channel/<provider>/` contains provider adapters; shared relay DTOs and conversion contracts live in the separate `relaykit/` module.
- `setting/` owns runtime configuration domains. Built-in expression pricing is in `setting/billing_setting/`; read `pkg/billingexpr/expr.md` before changing expression billing.
- `common/` contains cross-cutting infrastructure, including the required JSON wrappers and quota conversion helpers. `dto/`, `types/`, and `constant/` define API and relay contracts.
- `web/src/routes/` uses TanStack Router and generates `routeTree.gen.ts`. `web/src/features/` owns feature-level UI and logic; `web/src/components/` contains shared business and UI components; `web/src/lib/api` is the shared Axios layer; Zustand stores and TanStack Query manage client and server state.
- Frontend localization uses flat JSON files in `web/src/i18n/locales/`. User-facing React text must go through `useTranslation()`.

SQLite, MySQL, and PostgreSQL are all supported. Database-affecting changes require the real three-database verification matrix described in `AGENTS.md`; a successful SQLite test or root build is not sufficient.
