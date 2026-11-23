const CACHE_PREFIX = "actor-merit-ranker:actor:";
const DIRECTOR_CACHE_PREFIX = "actor-merit-ranker:director:";
export const SCORING_VERSION = "20.8";
export const DIRECTOR_SCORING_VERSION = "Director Scoring version 1.1";

export function isActorValid(actor) {
  if (!actor || typeof actor !== "object") return false;
  return (
    actor.scoring_version === SCORING_VERSION ||
    actor.scoring_version === "20.8" ||
    actor.scoring_version === "v20.8"
  );
}

export function isDirectorValid(dir) {
  if (!dir || typeof dir !== "object") return false;
  return (
    dir.scoring_version === DIRECTOR_SCORING_VERSION ||
    dir.scoring_version === "Director Scoring version 1.1" ||
    dir.scoring_version === "Director Scoring v1.1"
  );
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

export function getCachedDirector(id) {
  try {
    const raw = localStorage.getItem(DIRECTOR_CACHE_PREFIX + id);
    if (!raw) return null;
    const director = JSON.parse(raw);
    if (!director || !director.score) return null;
    if (director.scoring_version !== DIRECTOR_SCORING_VERSION && director.scoring_version !== "Director Scoring v1.1") {
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
