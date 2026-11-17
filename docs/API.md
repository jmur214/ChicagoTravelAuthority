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
  "maxStops": 5,                           // default 5
  "startLocation": { "lat": 41.88, "lng": -87.63 } // default: the Loop
}
```

Clients should treat the user's chosen time as Chicago time (see `zonedWallTimeToDate`
in `shared/src/time.ts`) and send the resulting instant.

Returns `{ "items": ItineraryItem[] }`. Only confirmed locations that are open on arrival
(or have unknown hours) are considered.

## Import

`POST /import` — `multipart/form-data` with a `file` field (KML or KMZ, max 10 MB by default).
Returns `{ total, imported, updated, errors }`. New places are created unconfirmed.

## Transit

- `GET /trains` → `{ generatedAt, trains: Train[] }` — live CTA positions, refreshed
  server-side every 20s (mock data when no API key is configured)
- `GET /gtfs/routes` → `TransitRoute[]` — "L" line polylines as `[lat, lon]` pairs

## Health

`GET /health` (also `/api/v1/health`) → `{ status: "ok", timestamp }`
