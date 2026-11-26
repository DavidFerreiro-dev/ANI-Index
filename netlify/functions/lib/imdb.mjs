// Server-side / backend IMDb helper for Netlify Functions & scripts
// Provides direct weighted rating blends and dual reviews fetching.
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

export function computeDualRating(tmdbRating, imdbRating, imdbWeight = 0.6) {
  const tmdb = Number(tmdbRating);
  const imdb = Number(imdbRating);
  const validTmdb = Number.isFinite(tmdb) && tmdb > 0 ? tmdb : 0;
  const validImdb = Number.isFinite(imdb) && imdb > 0 ? imdb : 0;
  if (validImdb > 0) {
    return (imdbWeight * validImdb) + ((1 - imdbWeight) * validTmdb);
  }
  return validTmdb;
}

export { fetchImdbReviews };

