# Actor Merit Ranker

Actor Merit Ranker is a React/Vite app for comparing actors from TMDb by a transparent acting-merit score. The project uses Netlify Functions for TMDb and Wikidata requests, and caches calculated actors in browser `localStorage`. There is no Python server or SQLite database.

## Features

- Top Rated and A–Z rankings from a committed seed
- Actor search and movie cast exploration
- Side-by-side actor comparison
- Actor score breakdown, notable awards and lead projects
- Top-six filmography weighting
- Credits from both movies and TV
- Prestige director and important saga multipliers
- Recent Oscar performance-win adjustment
- Commercial Impact for standalone films and one top-grossing appearance per collection
- Wikidata award data and TMDb attribution

## Architecture

- `src/` — React, Tailwind and UI components
- `public/seed-actors.json` — immediate fallback ranking
- `public/favicon.svg` — diamond favicon
- `netlify/functions/` — search, actor, cast and configuration Functions
- `netlify/functions/lib/scoring.mjs` — scoring implementation
- `netlify/functions/lib/scoring-config.mjs` — centralized weights and thresholds
- `directors.json` — curated prestigious directors
- `sagas.json` — curated film collections
- `curated_notes.json` — optional manually sourced historical notes

## Environment

Create a root `.env` file locally:

```text
TMDB_API_KEY=your_TMDb_key_or_read_token
```

Do not commit `.env`. It is excluded by `.gitignore`. Use `.env.example` as a template.

On Netlify, add `TMDB_API_KEY` under **Site configuration > Environment variables**.

## Local development

```bash
npm install
npm run dev
```

Netlify Dev serves the app and Functions at `http://localhost:8888`.

## Testing TMDb

```bash
npm run check-tmdb
```

## Seed and audit

Generate the static fallback ranking:

```bash
npm run seed
```

Run the 30-actor score audit:

```bash
npm run audit
```

Resolve TMDb IDs for the curated director list:

```bash
npm run resolve-directors
```

## Netlify deployment

1. Push the repository to GitHub.
2. Import the repository into Netlify.
3. Netlify reads `netlify.toml`.
4. Set `TMDB_API_KEY` in Netlify environment variables.
5. Deploy.

The build command is `npm run build`, the publish directory is `dist`, and Functions are loaded from `netlify/functions`.

## Scoring summary

- Filmography Quality: 40%
- Awards Prestige: 30%
- Genre Versatility: 15%
- Critical Sentiment: 15%

Filmography Quality uses the strongest weighted works rather than adding every valid title. Actors with fewer than five lead movies include supporting and series appearances; important saga or prestige-director work receives additional weight.

Performance Oscar wins within five years receive double Oscar points. Award data comes from Wikidata and may be incomplete.

## Data attribution

This product uses the TMDb API but is not endorsed or certified by TMDb. Awards data comes from Wikidata (CC0).
