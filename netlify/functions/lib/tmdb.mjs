const BASE = "https://api.themoviedb.org/3";
const movieDirectorCache = new Map();
const movieDetailsCache = new Map();
const tvDetailsCache = new Map();
const MAX_CONCURRENT_REQUESTS = 5;
let activeRequests = 0;
const requestQueue = [];

async function acquireRequestSlot() {
  if (activeRequests < MAX_CONCURRENT_REQUESTS) {
    activeRequests++;
    return;
  }
  await new Promise((resolve) => requestQueue.push(resolve));
}

function releaseRequestSlot() {
  if (requestQueue.length) requestQueue.shift()();
  else activeRequests--;
}

export async function tmdbGet(path, params = {}, timeoutMs = 8000) {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new Error("TMDB_API_KEY is not configured");
  const url = new URL(BASE + path);
  const headers = {};
  if (key.split(".").length === 3) {
    headers.Authorization = `Bearer ${key}`;
  } else {
    url.searchParams.set("api_key", key);
  }
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, String(value));

  for (let attempt = 0; attempt < 4; attempt++) {
    await acquireRequestSlot();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let retryDelayMs = 1500 * (attempt + 1);
    try {
      const response = await fetch(url, { headers, signal: controller.signal });
      if (!response.ok) {
        if (response.status === 404 || attempt === 3) {
          throw new Error(`TMDb request failed: ${response.status}`);
        }
        if (response.status !== 429 && response.status < 500) {
          throw new Error(`TMDb request failed: ${response.status}`);
        }
        if (response.status === 429) {
          const retryAfter = Number(response.headers.get("retry-after"));
          if (Number.isFinite(retryAfter) && retryAfter > 0) {
            retryDelayMs = retryAfter * 1000;
          }
        }
      } else {
        return await response.json();
      }
    } catch (error) {
      if (
        error.message?.startsWith("TMDb request failed:")
      ) throw error;
    } finally {
      clearTimeout(timer);
      releaseRequestSlot();
    }
    await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  }
  throw new Error("TMDb request failed after retries");
}

export async function searchPerson(q) {
  return (await tmdbGet("/search/person", { query: q, include_adult: "false" })).results;
}
export async function searchMovie(q) {
  return (await tmdbGet("/search/movie", { query: q, include_adult: "false" })).results;
}
export async function person(id) { return tmdbGet(`/person/${id}`); }
export async function movieCredits(id) { return (await tmdbGet(`/person/${id}/movie_credits`)).cast || []; }
export async function tvCredits(id) { return (await tmdbGet(`/person/${id}/tv_credits`)).cast || []; }
export async function personCrewCredits(id) { return (await tmdbGet(`/person/${id}/movie_credits`)).crew || []; }
export async function personTvCrewCredits(id) { return (await tmdbGet(`/person/${id}/tv_credits`)).crew || []; }
export async function externalIds(id) { return tmdbGet(`/person/${id}/external_ids`); }
export async function movie(id) { return tmdbGet(`/movie/${id}`); }
export async function movieCast(id) { return (await tmdbGet(`/movie/${id}/credits`)).cast || []; }
export async function movieCrew(id) { return (await tmdbGet(`/movie/${id}/credits`)).crew || []; }
export async function tvDetails(id) {
  if (tvDetailsCache.has(id)) return tvDetailsCache.get(id);
  try {
    const details = await tmdbGet(`/tv/${id}`, { append_to_response: "external_ids" });
    if (details) tvDetailsCache.set(id, details);
    return details;
  } catch {
    return null;
  }
}
export async function tvCreditsByShow(id) {
  try { return await tmdbGet(`/tv/${id}/credits`); }
  catch { return { cast: [], crew: [] }; }
}
export async function tvExternalIds(id) {
  try { return await tmdbGet(`/tv/${id}/external_ids`); }
  catch { return {}; }
}
export async function movieDirectors(id) {
  if (movieDirectorCache.has(id)) return movieDirectorCache.get(id);
  try {
    const credits = await tmdbGet(`/movie/${id}/credits`);
    const directors = (credits.crew || [])
      .filter((person) => person.job === "Director")
      .map((person) => ({ id: person.id, name: person.name }));
    movieDirectorCache.set(id, directors);
    return directors;
  } catch {
    return null;
  }
}
export async function movieDetails(id) {
  if (movieDetailsCache.has(id)) return movieDetailsCache.get(id);
  try {
    const details = await tmdbGet(`/movie/${id}`);
    if (details) movieDetailsCache.set(id, details);
    return details;
  } catch {
    return null;
  }
}
export async function reviews(id) {
  try { return (await tmdbGet(`/movie/${id}/reviews`, { language: "en-US" }, 5000)).results || []; }
  catch { return []; }
}
export async function movieExternalIds(id) {
  try { return await tmdbGet(`/movie/${id}/external_ids`); }
  catch { return {}; }
}
