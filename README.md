# Chicago Travel Authority

## About
Chicago Planner is a dynamic travel companion designed to help you discover and organize the perfect trip around the city. Whether you're a local looking for new spots or a tourist planning your first visit, this app allows you to:
- **Explore Interactively**: Visualize landmarks, restaurants, and transit lines on a 3D-enhanced map.
- **Filter by Vibe**: Find locations that match your mood, from "Nightlife" and "Live Music" to "Nature" and "Family Friendly."
- **Plan Smart Itineraries**: Build custom schedules with the Smart Planner wizard that understands travel times and opening hours.
- **Discover Hotspots**: Browse curated, verified locations to ensure you hit the best spots in town.

## Quick Start

### Prerequisites
- Node.js 20+ (22 recommended)
- PostgreSQL 14+

### Setup

1. **Install dependencies** (one install for the whole repo — it's an npm workspace)
   ```bash
   npm install
   ```

2. **Configure the server**
   ```bash
   cp server/.env.example server/.env   # then edit DATABASE_URL
   ```
   On a Mac with Homebrew Postgres: `brew install postgresql@16 && brew services start postgresql@16 && createdb chicago_planner`.
   The default Homebrew user is your macOS username with no password, e.g.
   `DATABASE_URL="postgresql://YOUR_USERNAME@localhost:5432/chicago_planner?schema=public"`.

3. **Create the schema and (optionally) demo data**
   ```bash
   npm run db:migrate -w server
   npm run db:seed -w server
   ```

4. **Run it** (two terminals)
   ```bash
   npm run dev:server   # API on http://localhost:3000/api/v1
   npm run dev:client   # app on http://localhost:5173 (proxies /api to the server)
   ```

### Upgrading an existing database (one time)

The migration history used to be out of sync with `schema.prisma` (the schema had been
changed without migrations). If your database was created before this fix, it already
has those columns — mark the catch-up migration as applied, then deploy the rest:

```bash
cd server
npx prisma migrate resolve --applied 20261117000000_sync_schema_drift
npx prisma migrate deploy
```

### Using it on your iPhone

The web app is phone-friendly and installable: open it in Safari, tap **Share → Add to Home Screen**,
and it launches full-screen with its own icon, like an app.

**Quick test on the same Wi-Fi as your computer**

```bash
npm run dev:server
npm run dev:phone                # like dev:client, but reachable from your phone; prints a "Network" URL
```

Open that URL on your phone. Everything works except **"Start near me"**: Safari only shares
location over HTTPS, so pick a neighborhood instead.

**Production (one process serves the app and the API)**

```bash
npm run build
npm start                         # http://localhost:3000 — app at /, API at /api/v1
```

Deploy that to any Node host with Postgres (Render, Railway, Fly.io, …). Set `DATABASE_URL`, run
`npm run db:migrate -w server` once, and use `npm run build` / `npm start` as the build and start commands.
Hosts provide HTTPS, so "Start near me" works there.

> Every endpoint — including edit, delete and import — is open to anyone who has the URL.
> Fine while it's just you, but add at least a password gate before sharing the link.

### Getting accurate place info (Google Places)

Hours, address, phone, website, price, rating and open/closed status come from Google Places.

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project, enable
   **Places API (New)**, and create an API key (restrict it to that API). Google bills per request
   with a monthly free allowance; check the current pricing page. Matching a few hundred places
   is roughly one request each.
2. Add it to `server/.env` as `GOOGLE_PLACES_KEY=...` and restart the server.
3. **One-time cleanup** of data from the old scripts (template hours, generated descriptions,
   unreadable hours). Run the report first, then apply:
   ```bash
   npm run places:audit -w server
   npm run places:audit -w server -- --fix
   ```
4. In the admin, click **Match & enrich**. Each place is looked up near its saved coordinates:
   - a single confident match (close by, similar name) is applied automatically;
   - anything uncertain shows up under **Need a Google match** for you to pick the right listing,
     search again, or mark "not on Google";
   - permanently closed places are flagged and hidden from the map.
   Run it again any time; it also refreshes matches older than 60 days (hours change).
   The same thing from a terminal: `npm run places:enrich -w server`.
5. To add a place, use **+ Add New Location → Find it on Google**. It's created with the full
   listing, then you add tags and categories.

Rules that keep data trustworthy: values you edit by hand are never overwritten by Google;
your own descriptions are kept (Google's summary only fills empty ones); missing data stays
empty instead of being guessed; every field records where it came from, shown in the edit form.

### Everyday commands (from the repo root)

| Command | What it does |
|---|---|
| `npm run typecheck` | Type-check shared, server and client |
| `npm run lint` | ESLint (client) |
| `npm test` | Unit tests everywhere. Set `TEST_DATABASE_URL` (a DB whose name contains `test`) to also run the API integration tests — **it gets wiped**. |
| `npm run build` | Production build of all three packages |
| `npm start` | Run the built server; it also serves the built web app |

CI (`.github/workflows/ci.yml`) runs all of the above, including integration tests against Postgres.

## Structure

```
shared/   @cta/shared — the API contract: zod request schemas, response types,
          and pure domain logic (opening hours, Chicago time, distance).
          Used by the server and client; reusable by a React Native app.
server/   Express + Prisma API
  src/app.ts            builds the Express app (no side effects; used by tests)
  src/index.ts          starts it + background transit polling
  src/config.ts         all environment variables, validated at startup
  src/routes/           thin HTTP handlers: validate input -> call a service
  src/services/         business logic and all database access
  src/middleware/       JSON error envelope
  prisma/               schema + migrations
  scripts/              one-off data scripts (seed, enrich, restore)
  tests/                unit + integration tests
client/   React + Vite + Tailwind + Leaflet web app
  src/api/              typed API client (the only place that calls fetch for our API)
  src/hooks/            data-loading hooks
  src/lib/              pure UI logic (heatmap, markers, filters) — unit tested
  src/components/       UI; admin tools live in components/admin (lazy-loaded)
docs/API.md             endpoint reference (start here for a mobile client)
```

## Building a mobile app

The backend is ready to serve an iPhone app as-is: a versioned JSON API (`/api/v1`),
consistent error bodies, ISO timestamps, and no browser-only assumptions (CORS only
matters for websites). See [docs/API.md](docs/API.md).

- **React Native / Expo:** depend on `@cta/shared` directly for types, validation and
  the hours/time helpers; `client/src/lib` logic is plain TypeScript too.
- **Native Swift:** use `docs/API.md` and `shared/src/models.ts` as the contract.
  Generating an OpenAPI spec from the zod schemas would allow generated Swift models.

Before shipping anything public: **add authentication** — every endpoint, including
create/update/delete and import, is currently open to anyone.

## Walkthrough

### 1. The Entrance
Your journey begins on the "train".
![Entrance](client/public/walkthrough/entrance.png)

### 2. The Dashboard
The main landing page. From here, you can choose to "Plan My Night" for a curated experience or quickly explore "Tonight's Picks" generated from live data.
![Dashboard](client/public/walkthrough/dashboard.png)

### 3. Planning a Night
The "Plan My Night" wizard guides you through reducing decision fatigue.

**Step 1: Choose Categories**
Select what you're interested in (e.g., Nightlife, Food, Culture).
![Categories](client/public/walkthrough/planner_step1_categories.png)

**Step 2: Pick Your Scene**
Choose a neighborhood vibe, from "Trendy Zone" (Wicker Park) to "High Energy" (River North).
![Scene](client/public/walkthrough/planner_step2_scene.png)

**Step 3: Set the Energy**
Dial in your preferred tempo for the night, from "Chill" to "Chaos".
![Energy](client/public/walkthrough/planner_step3_energy.png)

**Step 4: The Details**
Set your start time and budget cap to generate a realistic itinerary.
![Budget](client/public/walkthrough/planner_step4_budget.png)

### 4. Interactive Map
The map is the heart of the experience, featuring vibe-coded markers and real-time transit overlays. You are also able to view the plans from the "Plan My Night" wizard, as seen on the left. 
![Map](client/public/walkthrough/map.png)

**Smart Filtering**
Filter places by category to narrow down your options.
![Filters](client/public/walkthrough/map_filters.png)

**Location Insights**
Tap on any marker to see "Verified Vibes" (places our team has visited and verified), cost estimates, and average stay times. Recent updates (not pictured) also include hours of operation, and menus where applicable. 
![Details](client/public/walkthrough/location_details.png)

**Transit Integration**
See real-time CTA train lines and destinations directly on the map.
![Transit](client/public/walkthrough/map_train_line.png)

### 5. Data Management
An admin dashboard allows for managing the database of locations, tags, and categories.
![Admin](client/public/walkthrough/admin_dashboard.png)
