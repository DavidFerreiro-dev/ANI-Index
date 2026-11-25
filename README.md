# Actor & Director Merit Ranker — ANI Index

Actor & Director Merit Ranker is a serverless web application that evaluates and ranks cinematic careers through the **ANI Index** (*Artistic & Narrative Index*). The system integrates data from TMDb (filmographies, box office, cast/crew, and review sentiment) and Wikidata (awards and nominations), serving precomputed seeds alongside instant client-side caching (`localStorage`) and on-demand Netlify Functions.

---

## ANI Index Overview

The **ANI Index (Artistic & Narrative Index)** is an algorithmic multi-pillar evaluation system designed to measure sustained artistic merit, peer recognition, narrative versatility, and cultural impact while neutralizing franchise inflation and volume bias.

### 1. ANI Index — Actors v20.8

The actor model synthesizes five weighted pillars:

- **Filmography Quality (40%):** Evaluates the actor's career using a continuous sliding window (6 to 8 works), capped at a maximum of **2 films per franchise/collection** (`belongs_to_collection`):
  - **Career Sliding Window:** Evaluates all eligible works for careers with $\le 6$ works, sliding up to 8 works for careers with $\ge 14$ works.
  - **Short Careers (3–10 works):** Evaluates top 5 works with customized role weights (Lead 0: 1.35, Order 1: 1.05, Order 2: 0.65, Orders 3–5: 0.15, minor: 0.05) and softer volume calibration (midpoint 6.40, ceiling 7.45) to fairly reflect breakout performers without artificial inflation.
  - **Statistical Multipliers:** 1.25× prestige director multiplier, 1.15× awarded film multiplier, and standard billing order weights.
- **Awards Prestige (30%):** Weighted acting-specific honors:
  - **Tier S:** Academy Awards (Lead: 38 won / 10 nom; Supporting: 18 won / 6 nom) and festival/BAFTA honors (Lead: 24 won / 8 nom; Supporting: 11 won / 4.5 nom).
  - **Tier A:** Golden Globes, SAG, Critics Choice, and major industry guilds.
  - **Tier B / Genre:** Saturn Awards, Sitges, Satellite, and critics associations (subject to decay on repeat honors and capped at a maximum contribution of 15 points).
  - **Micro-score:** Other/regional honors receive +0.5 points each up to a strict cap of 10 points.
  - **Asymmetric continuous brake:** When Awards Prestige is lower than the Base Score ($A < B$), the final score dampens commercial/volume inflation: $\text{Overall} = 0.85 \times \text{Base} + 0.15 \times \text{Awards}$.
- **Commercial Impact (10%):** Top 5 post-1980 commercial projects combining logarithmic gross (80%) and revenue-to-budget ROI (20%), capped at 1 movie per collection. Standalone films without box office data in pre-1980 eras receive a conservative 65.
- **Critical Sentiment (10%):** VADER polarity scores of TMDb user review sentences mentioning the actor or their characters, with cinema-specific terms (dark, brutal, haunting, etc.) neutralized.
- **Genre Versatility (10%):** Counts distinct grouped genres across roles with billing order $\le 3$ and rating $\ge 6.5$.

### 2. ANI Index — Directors v1.1

The director model evaluates five directing-specific pillars:

- **Filmography Quality & Consistency (40%):**
  - **Peak (60%):** Bayesian average of the director's Top 4 valid features, capped at a maximum of 1 film per franchise.
  - **Consistency (40%):** Bayesian average of the Top 70% of their valid feature filmography ($\lceil N \times 0.70 \rceil$, min 3), capped at a maximum of 2 films per franchise.
  - Calibrated with a divisor of 2.35 to align top historical career peaks in the 93–95 range.
- **Awards & Festivals Prestige (25%):** Best Director, Best Picture, and Screenplay honors across Tier S (Oscars, Cannes Palme d'Or, Venice Golden Lion, Berlin Golden Bear), Tier A (BAFTA, DGA, Golden Globes, César, Goya, major festival direction prizes), and Tier B (Spirit, Gotham, critics associations).
- **Commercial Impact (15%):** Top 3 commercial features combining logarithmic gross (70%) and ROI (30%), with 1 franchise entry maximum and a 1.10× bonus for standalone original films.
- **Authorship & Versatility (10%):** 75% Genre Versatility (grouped genre coverage at rating $\ge 6.5$) + 25% Authorship Index (percentage of features where the director is credited for Writer, Screenplay, or Story).
- **Cultural Legacy (10%):** Logarithmic TMDb vote count distribution across the Top 5 most-voted features.

---

## Architecture

- `src/` — React 18, Tailwind CSS, Lucide icons, responsive modals, and search components
- `public/seed-actors.json` — Precomputed instant seed for 100 benchmark actors under `Actors v20.8`
- `public/seed-directors.json` — Precomputed instant seed for 123 benchmark directors under `Directors v1.1`
- `netlify/functions/` — Serverless functions:
  - `actors.mjs` — TMDb and Wikidata scoring pipeline for actors
  - `directors.mjs` — Directing career builder and scoring pipeline
  - `search.mjs` — Multi-entity search for actors and directors
- `netlify/functions/lib/scoring.mjs` — Core actor scoring algorithms and mathematical formulas
- `netlify/functions/lib/director.mjs` — Director evaluation formulas and pipeline
- `netlify/functions/lib/scoring-config.mjs` — Centralized weights, curve parameters, and thresholds

### Embeddable actor views

The direct routes `/{tmdb-id}/ani` and `/{slug}-{tmdb-id}/ani` render a compact score badge. Add `?compact=true` to hide the actor photo and name. The matching `/details` routes show the score breakdown. Actors not present in the static seed are calculated through the existing actor API and cached in the browser. Embed pages post an `ani-embed-resize` message to their parent window with the rendered height and TMDb ID.

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
