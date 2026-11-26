# Actor & Director Merit Ranker — ANI Index

Actor & Director Merit Ranker is a serverless web application that evaluates and ranks cinematic and television careers through the **ANI Index** (*Artistic & Narrative Index*). The system combines a daily **IMDb** dataset pipeline (GitHub Actions + jsDelivr CDN), real-time **TMDb** film & TV metadata, and **Wikidata** awards with direct weighted ratings (60% IMDb / 40% TMDb for films and directors; 75% IMDb / 25% TMDb for actor TV), without vote-volume smoothing.

> 📖 **Full Technical Documentation:** Available at [`/docs`](public/docs/index.html) (`public/docs/index.html`) — a self-contained Javadoc-style technical portal covering architecture, exact mathematical formulas, TV/film filters, and version history.

---

## ANI Index Overview

The **ANI Index (Artistic & Narrative Index)** measures sustained artistic merit, peer recognition, narrative versatility, and cultural impact across feature films, TV series, and miniseries while limiting franchise repetition and avoiding vote-volume rating smoothing.

### 1. ANI Index — Actors v26.5

The actor model synthesizes five weighted pillars across cinema and television (`tvSeries` / `tvMiniSeries` evaluated by episode participation percentage excluding Season 0 specials: `< 35%` discarded, `35–49% → 0.35`, `50–74% → 0.50`, `75–89% → 0.75`, `90–100% → 1.00`; TV vote gate `TMDb ≥ 50` or `IMDb ≥ 1,000`; non-penalization floor `max(scoreBaseCine, scoreConSeries)`):

- **Filmography Quality (40%):** Evaluates direct weighted ratings (**60% IMDb / 40% TMDb** for movies; **75% IMDb / 25% TMDb** for TV series, 100% TMDb fallback) on a continuous sliding window (6 to 8 works), without vote-volume smoothing:
  - **Franchise weighting:** Groups by `belongs_to_collection.id`, with title-root matching as fallback. All installments remain eligible; for each actor's titles in a franchise, the highest-rated receives 1.00×, followed by 0.60×, 0.40×, 0.25×, and 0.15× for subsequent installments. The decay affects Top 5 selection/quality and the consistency window.
  - **Career Sliding Window:** Evaluates all eligible works for careers with $\le 6$ works, sliding up to 8 works for careers with $\ge 14$ works.
  - **Short Careers (3–10 works):** Evaluates top 5 works with customized role weights (Lead 0: 1.35, Order 1: 1.05, Order 2: 0.65, Orders 3–5: 0.15, minor: 0.05) and softer volume calibration (midpoint 6.40, ceiling 7.45) to fairly reflect breakout performers without artificial inflation.
  - **Statistical Multipliers:** 1.25× prestige director multiplier, 1.15× awarded film multiplier, and standard billing order weights.
- **Score calibration:** The former additive historical-career bonus has been removed. Original pillar weights and the natural score ceiling (approximately 94) are preserved; ratings remain unsmoothed by vote volume.
- **Awards Prestige (30%):** Weighted acting-specific honors:
  - **Tier S:** Academy Awards (Lead: 38 won / 10 nom; Supporting: 18 won / 6 nom) and festival/BAFTA honors (Lead: 24 won / 8 nom; Supporting: 11 won / 4.5 nom).
  - **Tier A:** Golden Globes, SAG, Critics Choice, and major industry guilds.
  - **Tier B / Genre:** Saturn Awards, Sitges, Satellite, and critics associations (subject to decay on repeat honors and capped at a maximum contribution of 15 points).
  - **Micro-score:** Other/regional honors receive +0.5 points each up to a strict cap of 10 points.
  - **Threshold-gated asymmetric brake:** When the Base-to-Awards gap exceeds 18 points, the penalty scales smoothly up to a 15% brake. Gaps of 18 points or less use the awards-elevated or otherwise normal structural blend.
- **Commercial Impact (10%):** Top 5 post-1980 commercial projects combine decade-adjusted logarithmic gross (90%) with capped ROI (10%). ROI is clamped between 0.5× and 10× to suppress noisy low-budget outliers.
- **Critical Sentiment (10%):** VADER polarity scores of TMDb user review sentences mentioning the actor or their characters, with cinema-specific terms (dark, brutal, haunting, etc.) neutralized.
- **Genre Versatility (10%):** Counts distinct grouped genres across roles with billing order $\le 3$ and rating $\ge 6.5$.

### ANI Badge Tiers

- **Pure Diamond (93–100):** crystalline diamond-shaped badge.
- **Pseudodiamond (90–92):** standard circular badge with the ice-cyan diamond palette.
- **Gold (80–89):** standard circular badge with the usual gold palette.

Movie and TV detail sheets always show IMDb rating/votes, TMDb rating/votes, and the official weighted rating. Actor/director project tooltips show `IMDb X.X · TMDb X.X → Final X.X`.

Eligibility excludes missing or future release dates and films shorter than 45 minutes when runtime is available. TMDb calls are globally limited to five concurrent requests and retry rate limits; profiles with no valid works are retried and never cached.

### 2. ANI Index — Directors v5

The director model evaluates five directing-specific pillars across feature films, TV series (`episode_count >= 2`), and miniseries (`episode_count >= 1`, `type === "Miniseries"`), using direct **60% IMDb / 40% TMDb** ratings without vote-volume smoothing and grouping all episodes of a series as a single work:

- **Filmography Quality & Consistency (40%):**
  - **Peak (70%):** Weighted average of the director's Top 4 valid features, capped at a maximum of 1 film per franchise.
  - **Consistency (30%):** Weighted average of a capped 6–12 film sliding window, scaled with career length and capped at 2 films per franchise.
  - Scores above 88 use a logarithmic upper-end compression, keeping elite careers in a finely differentiated 92–95.5 range.
  - Calibrated with a divisor of 2.35 to align top historical career peaks in the 93–95 range.
- **Awards & Festivals Prestige (25%):** Best Director, Best Picture, and Screenplay honors across Tier S (Oscars, Cannes Palme d'Or, Venice Golden Lion, Berlin Golden Bear), Tier A (BAFTA, DGA, Golden Globes, César, Goya, major festival direction prizes), and Tier B (Spirit, Gotham, critics associations).
- **Commercial Impact (15%):** Top 3 commercial features combining logarithmic gross (70%) and ROI (30%), with 1 franchise entry maximum and a 1.10× bonus for standalone original films.
- **Authorship & Versatility (10%):** 75% Genre Versatility (grouped genre coverage at rating $\ge 6.5$) + 25% Authorship Index (percentage of features where the director is credited for Writer, Screenplay, or Story).
- **Cultural Legacy (10%):** Logarithmic TMDb vote count distribution across the Top 5 most-voted features, with a subtle era multiplier of up to 1.12× for pre-1990 classics with at least 100,000 votes.

---

## Architecture

- `src/` — React 18, Tailwind CSS, Lucide icons, responsive modals (`/movie/:id` & `/tv/:id`), and search components
- `public/docs/index.html` — Self-contained Javadoc-style technical documentation portal served at `/docs`
- `public/seed-actors.json` — Precomputed instant seed for benchmark actors (`Actors v26`)
- `public/seed-directors.json` — Precomputed instant seed for benchmark directors (`Directors v5`)
- `.github/workflows/update-imdb-ratings.yml` & `scripts/build-imdb-json.mjs` — Daily `05:00 UTC` GitHub Actions pipeline filtering `title.ratings.tsv.gz` + `title.basics.tsv.gz` (`movie`, `tvSeries`, `tvMiniSeries`, `numVotes >= 300`, excluding non-fiction) to the `data` branch for jsDelivr CDN distribution
- `netlify/functions/` — Serverless functions:
  - `actors.mjs` — TMDb (`movie_credits` + `tv_credits`), IMDb & Wikidata scoring pipeline for actors (`v26`)
  - `directors.mjs` — Directing career builder & scoring pipeline (`v5`)
  - `movie.mjs` / `movies.mjs` — Movie detail endpoint (`/api/movies/:id`)
  - `tv.mjs` — TV series & miniseries detail endpoint (`/api/tv/:id`)
  - `imdb-reviews.mjs` — IMDb public reviews scraper
  - `search.mjs` — Multi-entity search for actors and directors
- `netlify/functions/lib/scoring.mjs` — Core actor scoring algorithms and mathematical formulas
- `netlify/functions/lib/director.mjs` — Director evaluation formulas and pipeline
- `netlify/functions/lib/imdb.mjs` — Backend IMDb dataset loader and direct weighted-rating helper
- `netlify/functions/lib/scoring-config.mjs` — Centralized weights, curve parameters, and thresholds

### Embeddable actor and director views

Open an actor or director profile and select **Embed** to copy an iframe snippet for its score badge or full breakdown. Actor routes use `/{slug}-{tmdb-id}/ani` and `/{slug}-{tmdb-id}/details`; director routes use `/directors/{slug}-{tmdb-id}/ani` and `/directors/{slug}-{tmdb-id}/details`. Add `?compact=true` to an `/ani` route to hide the photo and name. Embed pages post an `ani-embed-resize` message to their parent window with the rendered height and TMDb ID; the copied snippet listens for this message to resize its iframe.

---

## Environment Setup

Create a `.env` file in the project root:

```text
TMDB_API_KEY=your_tmdb_api_key_or_bearer_token
```

On Netlify, set `TMDB_API_KEY` under **Site configuration > Environment variables**.

---

## Local Development

```bash
npm install
npm run dev
```

For full serverless function simulation with Netlify Dev:

```bash
npx netlify dev
```

---

## Build & Verification

```bash
# Verify production bundle
npm run build

# Regenerate actor/director seed files
node scripts/rebuild-seeds.mjs
```

---

## Data Attribution

- Filmographic credits, release dates, box office, and review content provided by [The Movie Database (TMDb)](https://www.themoviedb.org). This product uses the TMDb API but is not endorsed or certified by TMDb.
- Awards, nominations, and career honors sourced from [Wikidata](https://www.wikidata.org) (CC0).
