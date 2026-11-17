# AI Context - Chicago Travel Authority

## Project Overview
Helps users plan "what to do in Chicago" with a vibe-based approach. Curators import KML
from Google My Maps (folders become tags), organize tags into categories, and review
places; users browse a map and generate itineraries. A native iPhone app is planned, so
the API is treated as a public contract (see `docs/API.md`).

## Tech Stack
- **Monorepo:** npm workspaces — `shared/`, `server/`, `client/`. Run `npm install` at the root.
- **Shared (`@cta/shared`):** zod request schemas, response types, opening-hours and Chicago-time helpers.
- **Backend:** Node, Express 5, TypeScript, Prisma 5, PostgreSQL. API at `/api/v1`.
- **Frontend:** React 19, Vite 7, Tailwind 4, React-Leaflet.
- **Tests:** vitest everywhere; server integration tests use supertest + a real Postgres (`TEST_DATABASE_URL`).

## Conventions
- Request validation: parse with the shared zod schema inside the route (`Schema.parse(req.body)`);
  thrown errors become the standard `{ error: { code, message, details } }` body (`middleware/errorHandler.ts`).
  Express 5 forwards async errors automatically — no try/catch in routes.
- Routes stay thin; Prisma is only used in `server/src/services/`.
- PATCH semantics for updates: omitted fields are untouched; `""` clears a text field.
- Client calls the API only through `client/src/api/client.ts`; data loading via `hooks/useApiData`.
- Pure logic goes in `shared/src` (if the server or a mobile app could use it) or `client/src/lib`, with tests.
- Times of day are Chicago local time (`America/Chicago`), independent of server/device TZ.
- The `Folder` category is internal (raw KML folder tags) — hide it from users (`FOLDER_CATEGORY_NAME`).
- Schema changes: edit `schema.prisma`, then `npx prisma migrate dev --name <change>`. Never `db push`
  against a shared database — that's how the migration history drifted before.

## Data Model
- **Location:** POI. `isConfirmed` = visible publicly; `verifiedVibe` = staff seal; `openHours` JSON (see `shared/src/openHours.ts`); `metadata` JSON for extras (e.g. `imageUrl`, `originalFolders`).
- **Tag:** free-form label (KML folder names land here). Many-to-many with categories.
- **TagCategory:** hierarchical (`parentId`), with marker `color`/`shape`. Many-to-many with tags and locations.
- **LocationTag:** explicit join table; cascades on delete.

## Key Features
1. **KML/KMZ import** (`services/importService.ts`): idempotent by name + ~10m proximity; new places are unconfirmed.
2. **Map:** category-styled markers, time-of-day heatmap, live CTA trains (mock without `CTA_TRAIN_API_KEY`), "L" lines from a GTFS feed (`GTFS_DIR`).
3. **Planner** (`services/planning/planner.ts`, pure + tested): greedy — best score of proximity, category/tag matches and budget, skipping places closed on arrival. Only confirmed locations.

## Known gaps / next steps
- **No authentication** — all writes are public.
- `energyLevel` and `neighborhoods` are accepted by `/plan` but not used in scoring.
- "Add to Plan" in location details is a placeholder.
- Consider TanStack Query on the client and OpenAPI generation (for Swift models).
