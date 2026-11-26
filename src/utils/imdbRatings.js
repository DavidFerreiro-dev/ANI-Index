// Client-side IMDb ratings loader & cache
// URL: https://cdn.jsdelivr.net/gh/DavidFerreiro-dev/Actor_Merit_Ranker@data/imdb-ratings.json
// Caches in IndexedDB / Cache API / localStorage with 24-hour expiration and in-memory map.

const JSDELIVR_URL = "https://cdn.jsdelivr.net/gh/DavidFerreiro-dev/ANI-Index@data/imdb-ratings.json";
const CACHE_NAME = "ani_imdb_ratings_v1";
const CACHE_KEY = "imdb_ratings_data";
const CACHE_TIMESTAMP_KEY = "imdb_ratings_ts";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

let inMemoryRatings = null;
let loadPromise = null;

// IndexedDB Helper
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      resolve(null);
      return;
    }
    const request = indexedDB.open("ANI_IMDB_STORE", 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains("ratings")) {
        db.createObjectStore("ratings");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

async function getFromIDB() {
  try {
    const db = await openDB();
    if (!db) return null;
    return new Promise((resolve) => {
      const tx = db.transaction("ratings", "readonly");
      const store = tx.objectStore("ratings");
      const req = store.get(CACHE_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function saveToIDB(data) {
  try {
    const db = await openDB();
    if (!db) return;
    const tx = db.transaction("ratings", "readwrite");
    const store = tx.objectStore("ratings");
    store.put(data, CACHE_KEY);
  } catch {}
}

export async function loadImdbRatings() {
  if (inMemoryRatings) return inMemoryRatings;
  if (loadPromise) return loadPromise;

  loadPromise = (async () => {
    const now = Date.now();
    const storedTs = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    // 1. Check IndexedDB if cached within 24 hours
    if (storedTs && now - Number(storedTs) < CACHE_DURATION_MS) {
      const cached = await getFromIDB();
      if (cached && typeof cached === "object") {
        inMemoryRatings = cached;
        return inMemoryRatings;
      }
    }

    // 2. Fetch from jsDelivr (or local fallback)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(JSDELIVR_URL, { signal: controller.signal });
      clearTimeout(timer);

      if (res.ok) {
        const json = await res.json();
        inMemoryRatings = json;
        localStorage.setItem(CACHE_TIMESTAMP_KEY, String(now));
        await saveToIDB(json);
        return inMemoryRatings;
      }
    } catch (err) {
      console.warn("IMDb ratings dataset fetch failed from jsDelivr; attempting cached copy:", err.message);
    }

    // Fallback: If network failed, check if we have an older IndexedDB copy
    const fallbackCached = await getFromIDB();
    if (fallbackCached) {
      inMemoryRatings = fallbackCached;
      return inMemoryRatings;
    }

    inMemoryRatings = {};
    return inMemoryRatings;
  })();

  return loadPromise;
}

/**
 * Returns [averageRating, numVotes] or null for a given tconst (tt...)
 */
export function getImdbRating(tconst) {
  if (!tconst || !inMemoryRatings) return null;
  return inMemoryRatings[tconst] || null;
}

/** Combines IMDb and TMDb ratings directly without vote-volume smoothing. */
export function computeCombinedRating(tmdbRating, imdbRating) {
  const tmdb = Number(tmdbRating);
  const imdb = Number(imdbRating);
  const validTmdb = Number.isFinite(tmdb) && tmdb > 0 ? tmdb : 0;
  const validImdb = Number.isFinite(imdb) && imdb > 0 ? imdb : 0;
  if (validImdb > 0) {
    return (0.6 * validImdb) + (0.4 * validTmdb);
  }
  return validTmdb;
}

