# Chicago Travel Authority API (v1)

The web app and any future mobile client (iOS, React Native) use the same JSON API.
The source of truth for request shapes is [`shared/src/schemas.ts`](../shared/src/schemas.ts)
(zod) and for response shapes [`shared/src/models.ts`](../shared/src/models.ts).

- **Base URL:** `https://<host>/api/v1` (`/api` is a legacy alias for older web builds)
- **Format:** JSON in and out; dates are ISO-8601 strings in UTC
- **Times of day** (opening hours, planner input) are Chicago local time — see below
- **Auth:** none yet. Every endpoint, including writes, is public. Add auth before a public launch.

## Errors

Every non-2xx response has the same body:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": [{ "path": "latitude", "message": "Invalid input: expected number, received string" }]
  }
}
```

| Status | `code`             | When                                                       |
|--------|--------------------|------------------------------------------------------------|
| 400    | `VALIDATION_ERROR` | Body/params failed validation. `details` lists fields.     |
| 400    | `BAD_REQUEST`      | Malformed JSON, missing upload, unknown referenced id, etc.|
| 404    | `NOT_FOUND`        | Unknown id or route                                        |
| 409    | `CONFLICT`         | Duplicate unique name (tag/category)                       |
| 500    | `INTERNAL_ERROR`   | Bug — check server logs                                    |

## Locations

| Method | Path                | Body                    | Returns                     |
|--------|---------------------|-------------------------|-----------------------------|
| GET    | `/locations`        | —                       | `Location[]` (confirmed only) |
| GET    | `/locations?all=true` | —                     | `Location[]` incl. pending review |
| GET    | `/locations/:id`    | —                       | `Location`                  |
| POST   | `/locations`        | `LocationCreate`        | `201` `Location`            |
| PATCH  | `/locations/:id`    | any subset of `LocationCreate` | `Location`           |
| DELETE | `/locations/:id`    | —                       | `204`                       |

`PATCH` only changes the fields you send (`PUT` behaves the same, for older clients).
`tagIds` / `categoryIds` replace the whole set when present. Sending `""` for a text or
URL field clears it (stored as `null`).

```jsonc
// LocationCreate
{
  "name": "The Violet Hour",          // required
  "latitude": 41.9087,                // required, -90..90
  "longitude": -87.6776,              // required, -180..180
  "description": "Speakeasy",
  "address": "1520 N Damen Ave",
  "website": "https://…",             // http(s) only
  "menuUrl": "https://…",
  "eventsInfo": "Happy hour 4–6",
  "phoneNumber": "…",
  "avgCost": 3,                       // 1–4 ($–$$$$)
  "avgStayMinutes": 90,
  "openHours": { "mon": { "isOpen": true, "open": "17:00", "close": "02:00" } },
  "isConfirmed": false,               // shown publicly once true
  "verifiedVibe": false,
  "tagIds": [1, 2],
  "categoryIds": [3]
}
```

### Opening hours

`openHours` keys are `mon`…`sun`; times are `HH:MM` 24h **Chicago local time**.
A `close` at or before `open` means the venue closes after midnight. Missing days are
closed; `openHours: null` means unknown. `getOpenStatus()` in `shared/src/openHours.ts`
is the reference implementation.

## Categories & tags

| Method | Path                                  | Body                                   |
|--------|---------------------------------------|----------------------------------------|
| GET    | `/categories`                         | — (each includes `tags`)               |
| POST   | `/categories`                         | `{ name, parentId?, color?, shape?, isSingleSelect? }` |
| PATCH  | `/categories/:id`                     | any subset                             |
| DELETE | `/categories/:id`                     | — (children move to top level)         |
| GET    | `/tags`                               | — (each includes `categories`)         |
| POST   | `/tags`                               | `{ name, categoryIds? }`               |
| PATCH  | `/tags/:id`                           | `{ name }`                             |
| DELETE | `/tags/:id`                           | — (also removed from locations)        |
| POST   | `/tags/:id/categories`                | `{ categoryId }`                       |
| DELETE | `/tags/:id/categories/:categoryId`    | —                                      |

`color` is `#RRGGBB`; `shape` is one of `circle`, `star`, `diamond`, `ring`.
The category named `Folder` is internal (raw KML folder tags) and should be hidden from users.

## Planning

`POST /plan`

```jsonc
{
  "startTime": "2026-11-18T02:00:00.000Z", // must include Z or an offset; default now
  "durationHours": 4,                      // default 4
  "categoryIds": [3],
  "vibes": ["Cocktails"],                  // tag names
  "transportMode": "walk",                 // walk | drive | transit (default drive)
  "budget": 2,                             // 1–4
  "energyLevel": 4,                        // 1 chill – 5 chaos
  "maxStops": 5,                           // default 5
  "neighborhood": "wicker-park",           // see NEIGHBORHOODS in shared/src/neighborhoods.ts
  "startLocation": { "lat": 41.91, "lng": -87.68 } // wins over neighborhood; default: the Loop
}
```

Clients should treat the user's chosen time as Chicago time (see `zonedWallTimeToDate`
in `shared/src/time.ts`) and send the resulting instant.

Response:

```jsonc
{
  "items": [{
    "order": 1, "locationId": 12, "name": "Kingston Mines", "description": "…",
    "coords": { "lat": 41.93, "lng": -87.65 },
    "arrivalTime": "…", "departureTime": "…",
    "travelTimeMinutes": 13, "travelMode": "transit",
    "reason": "Matches: Nightlife",
    "matchScore": 88,            // 10–99; 0 for stops a user added by hand
    "isOpenOnArrival": true      // null when hours are unknown
  }],
  "startTime": "…", "startLocation": { "lat": …, "lng": … }, "transportMode": "transit"
}
```

How stops are chosen: only confirmed locations that are open on arrival (or have unknown
hours). Each step picks the best score of travel time, category/tag matches, budget fit and
energy fit. Energy is estimated from tag/category names (`shared/src/energy.ts`), and the
first stop aims one level lower as a warm-up.

Editing a plan (add/remove/reorder, change travel mode) doesn't need the server:
`scheduleStops()` in `shared/src/planning.ts` re-times a list of stops using the
plan's `startTime`, `startLocation` and `transportMode`.

## Place data (Google Places)

All of these return `503 NOT_CONFIGURED` when the server has no `GOOGLE_PLACES_KEY`, and
`502 UPSTREAM_ERROR` (with Google's message) when Google rejects a request.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET  | `/places/status` | — | `{ provider: "google", configured }` |
| GET  | `/places/search?q=&lat=&lng=` | — | `ScoredCandidate[]`, best first (lat/lng optional) |
| POST | `/locations/:id/enrich` | — | `EnrichResult`: match it (or refresh it if already matched) |
| POST | `/locations/:id/match` | `{ externalId }` or `{ ignore: true }` | `EnrichResult` |
| POST | `/locations/from-place` | `{ externalId, name?, isConfirmed? }` | `201 EnrichResult`; `409` if already added |

```jsonc
// EnrichResult
{
  "status": "matched",          // matched | needs_review | no_match | ignored
  "location": { /* Location */ },
  "changes": [{ "field": "openHours", "from": null, "to": { /* … */ } }],
  "candidates": []              // ScoredCandidate[] when needs_review / no_match
}
// ScoredCandidate = PlaceCandidate (name, address, latitude, longitude, openHours, phoneNumber,
//   website, rating, reviewCount, avgCost, businessStatus, googleMapsUrl, types, summary)
//   + { distanceMeters, nameScore (0–1), confidence: "high" | "medium" | "low" }
```

Matching: Text Search near the location's coordinates (500 m bias). It auto-applies only when
exactly one candidate is high-confidence (≤150 m with a similar name, or ≤50 m). Otherwise the
location gets `matchStatus: "needs_review"` / `"no_match"` and `matchCandidates`.

Locations also carry `businessStatus`, `googleMapsUrl`, `matchStatus`, `matchCandidates`,
`enrichedAt`, and `fieldSources` (`{ field: { source: "google" | "manual" | "kml" | "estimate", at } }`).
`PATCH /locations/:id` marks changed fields `manual`, and enrichment never overwrites those.
`GET /locations` (public) omits permanently closed places, and `/plan` also skips temporarily closed ones.

Opening hours may hold several windows per day:
`{ "isOpen": true, "open": "11:00", "close": "14:30", "additional": [{ "open": "16:30", "close": "22:00" }] }`.

## Import

`POST /import` — `multipart/form-data` with a `file` field (KML or KMZ, max 10 MB by default).
Returns `{ total, imported, updated, errors }`. New places are created unconfirmed.

## Transit

- `GET /trains` → `{ generatedAt, trains: Train[] }` — live CTA positions, refreshed
  server-side every 20s (mock data when no API key is configured)
- `GET /gtfs/routes` → `TransitRoute[]` — "L" line polylines as `[lat, lon]` pairs

## Health

`GET /health` (also `/api/v1/health`) → `{ status: "ok", timestamp }`
