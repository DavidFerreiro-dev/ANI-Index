# Actor Merit Ranker

React/Vite application deployed entirely on Netlify. TMDb calls and Wikidata calculations run through Netlify Functions. Actor results are cached in browser `localStorage`; the repository no longer includes Python, SQLite or a backend server.

## Netlify setup

1. Push the repository to GitHub.
2. In Netlify, choose **Add new site > Import an existing project**.
3. Netlify reads `netlify.toml`: it runs `npm run build`, publishes `dist`, and loads Functions from `netlify/functions`.
4. Open **Site configuration > Environment variables** and add `TMDB_API_KEY`.
5. Deploy the site.

## Local development

Create a root `.env` file locally:

```text
TMDB_API_KEY=your_tmdb_key_or_read_token
```

Then run:

```bash
npm install
npm run dev
```

Do not commit `.env`. Use `.env.example` as the template.

Check that the key is working:

```bash
npm run check-tmdb
```

## Static seed

The committed `public/seed-actors.json` allows the ranking to appear immediately.

```bash
npm run seed
```

This script calculates roughly 28 varied actors and overwrites the seed JSON.

## Few-work filmographies

For fewer than 8 valid movies and series, the Filmography Quality pillar includes the actor's complete
valid filmography. Series and supporting roles count, but the result is still a weighted average.

## Director resolution

Configure `TMDB_API_KEY`, then run:

```bash
npm run resolve-directors
```

The script updates `directors.json` with resolved TMDb IDs and writes unresolved names to
`directors-unresolved.json`. Ambiguous or failed matches are never guessed.

## Cache

Calculated actors are stored in browser `localStorage`. When `SCORING_VERSION` in
`netlify/functions/lib/scoring-config.mjs` changes, cached actors with a different version are recalculated.

## Scoring audit

```bash
npm run audit
```

The audit prints roughly 30 actors with final scores, four pillars, counted awards, ignored awards and Wikidata availability.

## Limitations

The free Netlify plan limits Function execution time and monthly compute credits. The ranking uses short TMDb/Wikidata fallbacks, browser caching and the committed static seed to remain usable.
