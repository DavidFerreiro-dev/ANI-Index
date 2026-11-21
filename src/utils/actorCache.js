const CACHE_PREFIX = "actor-merit-ranker:actor:";
const SCORING_VERSION = 18;

export function getCachedActor(id) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id);
    if (!raw) return null;
    const actor = JSON.parse(raw);
    if (actor.awards_status === "unavailable") return null;
    return actor.scoring_version === SCORING_VERSION ? actor : null;
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
