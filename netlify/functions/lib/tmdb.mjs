const BASE = "https://api.themoviedb.org/3";
const movieDirectorCache = new Map();
const movieDetailsCache = new Map();

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
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`TMDb request failed: ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
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
export async function externalIds(id) { return tmdbGet(`/person/${id}/external_ids`); }
export async function movie(id) { return tmdbGet(`/movie/${id}`); }
export async function movieCast(id) { return (await tmdbGet(`/movie/${id}/credits`)).cast || []; }
export async function movieCrew(id) { return (await tmdbGet(`/movie/${id}/credits`)).crew || []; }
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
    movieDirectorCache.set(id, null);
    return null;
  }
}
export async function movieDetails(id) {
  if (movieDetailsCache.has(id)) return movieDetailsCache.get(id);
  try {
    const details = await tmdbGet(`/movie/${id}`);
    movieDetailsCache.set(id, details);
    return details;
  } catch {
    movieDetailsCache.set(id, null);
    return null;
  }
}
export async function reviews(id) {
  try { return (await tmdbGet(`/movie/${id}/reviews`, { language: "en-US" }, 5000)).results || []; }
  catch { return []; }
}
