# Competitive Intelligence Agent

A web dashboard for tracking competitors, collecting public intelligence, reviewing activity, and querying long-term competitor memory.

## Features

- Track competitors and review their recent events, activity, categories, and trends.
- Gather intelligence from public RSS feeds or URLs through the existing ingestion pipeline: fetch, extract with Gemini when configured, validate, deduplicate, save to Supabase, and retain in Hindsight.
- Ask the Competitive Intelligence Agent questions grounded in competitor events and Hindsight memories.
- Run trend analysis and compare competitors over selected periods.

## Requirements

- Node.js 18 or newer
- npm
- Supabase project configuration for persistent competitor and event data
- Optional: Gemini and Hindsight credentials for AI extraction and memory features

## Setup

Install the dependencies and start the server:

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). For development with automatic server restarts, run `npm run dev`.

The Express server serves the frontend and API from the same origin. No frontend build step is required.

## Configuration

Create a root `.env` file for server-side settings. Keep credentials private and do not commit them.

```dotenv
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
HINDSIGHT_API_KEY=your-hindsight-api-key
HINDSIGHT_BASE_URL=https://api.hindsight.vectorize.io
HINDSIGHT_BANK_ID=competitive-intelligence
```

Set only the integrations you use. `PORT` defaults to `3000`; the Hindsight base URL and bank ID have defaults shown above. The service-role key and AI provider keys are for the server only and must never be added to browser code.

The browser's Supabase client is configured separately in `js/data/supabase.config.js`. Configure that file with the project URL and public anon key for direct dashboard data access. Database row-level security policies control which operations the current role can perform.

## Available Scripts

| Command | Purpose |
| --- | --- |
| `npm start` | Start the Express server |
| `npm run dev` | Start the server with Node's watch mode |
| `npm run demo` | Run the Hindsight demo seed script |
| `npm run sync` | Sync existing competitor events to Hindsight |

## Intelligence Collection

Use **Gather Intelligence** on a competitor to start collection. The backend selects the competitor by ID and uses its configured RSS/news URL, a known source, or its website. A source URL can also be supplied directly to the API.

```http
POST /api/intelligence/collect
Content-Type: application/json

{
  "competitorId": "competitor-uuid",
  "sourceUrl": "https://example.com/feed"
}
```

`sourceUrl` is optional. The response includes collection counts, created events, and any collection error. The ingestion service is in `services/ingestion/`; source fetching, extraction, validation, deduplication, and Hindsight retention are handled by its existing modules.

## API Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Backend and integration status |
| `GET` | `/api/hindsight/status` | Hindsight connection status |
| `POST` | `/api/intelligence/collect` | Collect and process competitor intelligence |
| `POST` | `/api/intelligence/trends` | Analyze competitor trends |
| `POST` | `/api/intelligence/compare-trends` | Compare two competitors' trends |
| `POST` | `/api/agent/competitive-intelligence` | Query the intelligence agent |
| `POST` | `/api/hindsight/retain` | Retain an event in Hindsight |
| `POST` | `/api/hindsight/recall` | Recall relevant Hindsight memories |
| `POST` | `/api/hindsight/reflect` | Hindsight reflection endpoint |
| `POST` | `/api/hindsight/sync` | Sync stored events to Hindsight |

## Project Structure

- `server.js` — Express server, static hosting, and API routes
- `index.html`, `css/`, `js/` — Dashboard UI and browser-side data access
- `services/agent/` — Competitive Intelligence Agent and tools
- `services/ingestion/` — Public-source collection and event processing
- `services/intelligence/` — Trend and period comparison logic
- `services/gemini.js` — Server-side Gemini integration
- `services/hindsight.js` — Hindsight retain, recall, and sync integration
- `supabase/` — Database schema, migrations, and seed SQL
