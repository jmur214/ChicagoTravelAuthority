# AI Context - Chicago Planner App

## Project Overview
This app helps users plan "what to do in Chicago" using a vibe-based clustering approach. It imports KML data from Google Earth, maps folder structures to tags, and generates itineraries based on user preferences.

## Tech Stack
- **Frontend**: React, Vite, TailwindCSS, React-Leaflet
- **Backend**: Node.js, Express, TypeScript, Prisma (v5), PostgreSQL (PostGIS enabled in db but simple float lat/lng used in schema for MVP)
- **Monorepo**: `client/` and `server/` directories.

## Data Model
- **Location**: Stores POIs. `metadata` JSON field used for extended attributes.
- **Tag**: Categorized into 'Primary' (Bar, Restaurant), 'Neighborhood' (Wicker Park), 'Purpose' (Cocktails), etc.
- **LocationTag**: Many-to-many link.

## Key Features
1. **KML Import**:
   - Parses KML files recursively.
   - Maps folder names to Tags (e.g., "Bars" -> Primary: Bar).
   - Idempotent-ish (simple create for MVP, duplicates possible if not careful).
2. **Interactive Map**:
   - Leaflet-based.
   - Custom markers (using default Leaflet icon for now, easily swappable).
   - Filtering by Primary Tag and Search.
3. **Planning Engine**:
   - `PlanningService` scores locations based on Vibe match.
   - Generates a linear itinerary.
   - "Search & Swiping" planned for future, currently simple generation.

## Future Plans
- **Authentication**: User accounts to save plans.
- **ML Scoring**: Replace heuristic scoring with learning model.
- **Real-time Weather**: Integrate weather API to weight tags (e.g. avoid Patios if raining).

## Developer Notes
- Run `npm run dev` in both `client` and `server`.
- Prisma Schema: `server/prisma/schema.prisma`.
- Env vars: `server/.env`.
