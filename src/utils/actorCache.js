const CACHE_PREFIX = "actor-merit-ranker:actor:";
const DIRECTOR_CACHE_PREFIX = "actor-merit-ranker:director:";
const DYNAMIC_ACTORS_KEY = "ani_dynamic_seeds";
export const SCORING_VERSION = "22.0";
export const DIRECTOR_SCORING_VERSION = "Director Scoring version 2.0";
export const ANI_ALGO_VERSION = "actors-v22.0_directors-v2.0";
const ANI_ALGO_VERSION_KEY = "ani_algo_version";

export function purgeStaleAniCache() {
  try {
    const storedVersion = localStorage.getItem(ANI_ALGO_VERSION_KEY);
    if (storedVersion === ANI_ALGO_VERSION) return;
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index);
      if (key?.startsWith(CACHE_PREFIX) || key?.startsWith(DIRECTOR_CACHE_PREFIX) || key === DYNAMIC_ACTORS_KEY) {
        localStorage.removeItem(key);
      }
    }
    localStorage.setItem(ANI_ALGO_VERSION_KEY, ANI_ALGO_VERSION);
  } catch {}
}

export function isActorValid(actor) {
  if (!actor || typeof actor !== "object") return false;
  return (
    actor.scoring_version === SCORING_VERSION ||
    actor.scoring_version === "22.0" ||
    actor.scoring_version === "v22.0"
  );
}

export function isDirectorValid(dir) {
  if (!dir || typeof dir !== "object") return false;
  return dir.scoring_version === DIRECTOR_SCORING_VERSION ||
    dir.scoring_version === "Director Scoring v2.0";
}

export function getCachedActor(id) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const actor = JSON.parse(raw);
    if (actor.awards_status === "unavailable") {
      localStorage.removeItem(CACHE_PREFIX + id);
      return null;
    }
    if (!isActorValid(actor)) {
      localStorage.removeItem(CACHE_PREFIX + id);
      return null;
    }
    return actor;
  } catch {
    return null;
  }
}

export function getCachedActors() {
  try {
    const actors = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(CACHE_PREFIX)) continue;
      const actor = getCachedActor(key.slice(CACHE_PREFIX.length));
      if (actor) actors.push(actor);
    }
    return actors;
  } catch {
    return [];
  }
}

export function cacheActor(actor) {
  if (!actor?.id) return;
  if (actor.awards_status === "unavailable") return;
  try {
    localStorage.setItem(CACHE_PREFIX + actor.id, JSON.stringify(actor));
  } catch {}
}

export function getDynamicCachedActor(id) {
  try {
    const stored = JSON.parse(localStorage.getItem(DYNAMIC_ACTORS_KEY) || "{}");
    const actor = stored[String(id)];
    if (!isActorValid(actor) || !Number.isFinite(actor.score) || !actor.pillars) return null;
    return actor;
  } catch {
    return null;
  }
}

export function cacheDynamicActor(actor) {
  if (!actor?.id || !isActorValid(actor) || !Number.isFinite(actor.score) || !actor.pillars) return;
  try {
    const stored = JSON.parse(localStorage.getItem(DYNAMIC_ACTORS_KEY) || "{}");
    stored[String(actor.id)] = actor;
    localStorage.setItem(DYNAMIC_ACTORS_KEY, JSON.stringify(stored));
  } catch {}
}

export function getCachedDirector(id) {
  try {
    const raw = localStorage.getItem(DIRECTOR_CACHE_PREFIX + id);
    if (!raw) return null;
    const director = JSON.parse(raw);
    if (!director || !director.score) return null;
    if (!isDirectorValid(director)) {
      localStorage.removeItem(DIRECTOR_CACHE_PREFIX + id);
      return null;
    }
    return director;
  } catch {
    return null;
  }
}

export function getCachedDirectors() {
  try {
    const directors = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith(DIRECTOR_CACHE_PREFIX)) continue;
      const director = getCachedDirector(key.slice(DIRECTOR_CACHE_PREFIX.length));
      if (director) directors.push(director);
    }
    return directors;
  } catch {
    return [];
  }
}

export function cacheDirector(director) {
  if (!director?.id || !director?.score) return;
  try {
    localStorage.setItem(DIRECTOR_CACHE_PREFIX + director.id, JSON.stringify(director));
  } catch {}
}
