// Server-side / backend IMDb helper for Netlify Functions & scripts
// Provides combined Bayesian calculation (60% IMDb / 40% TMDb) and dual reviews fetching.
import { fetchImdbReviews } from "../imdb-reviews.mjs";

const JSDELIVR_IMDB_URL = "https://cdn.jsdelivr.net/gh/DavidFerreiro-dev/ANI-Index@data/imdb-ratings.json";

let cachedRatings = null;
let loadPromise = null;

export async function getBackendImdbRatings(timeoutMs = 5000) {
  if (cachedRatings) return cachedRatings;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(JSDELIVR_IMDB_URL, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        cachedRatings = await res.json();
        return cachedRatings;
      }
    } catch {
      // Fallback if network/offline
    }
    cachedRatings = {};
    return cachedRatings;
  })();

  return loadPromise;
}

/**
 * Calculates combined Bayesian prior (60% IMDb / 40% TMDb)
 * Formula:
 * Bayes_TMDb = (v_tmdb / (v_tmdb + 200)) * rating_tmdb + (200 / (v_tmdb + 200)) * 6.5
 * If IMDb exists:
 * Bayes_IMDb = (v_imdb / (v_imdb + 200)) * rating_imdb + (200 / (v_imdb + 200)) * 6.5
 * Bayes_Final = (0.6 * Bayes_IMDb) + (0.4 * Bayes_TMDb)
 * Otherwise Bayes_Final = Bayes_TMDb
 */
export function computeDualBayes(tmdbRating, tmdbVotes, imdbRating, imdbVotes) {
  const m = 200;
  const C = 6.5;

  const vT = Number(tmdbVotes) || 0;
  const rT = Number(tmdbRating) || 0;
  const bayesTmdb = (vT / (vT + m)) * rT + (m / (vT + m)) * C;

  const vI = Number(imdbVotes) || 0;
  const rI = Number(imdbRating) || 0;

  if (rI > 0 && vI >= 10) {
    const bayesImdb = (vI / (vI + m)) * rI + (m / (vI + m)) * C;
    return (0.6 * bayesImdb) + (0.4 * bayesTmdb);
  }

  return bayesTmdb;
}

export { fetchImdbReviews };

