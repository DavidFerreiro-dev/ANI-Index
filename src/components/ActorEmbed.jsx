import { useEffect, useLayoutEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import ScoreBadge from "./ScoreBadge.jsx";
import {
  cacheActor,
  cacheDirector,
  cacheDynamicActor,
  getCachedActor,
  getCachedDirector,
  getDynamicCachedActor
} from "../utils/actorCache.js";

const ACTOR_PILLARS = [
  ["quality", "Filmography Quality", 40],
  ["awards", "Awards Prestige", 30],
  ["versatility", "Genre Versatility", 10],
  ["sentiment", "Critical Sentiment", 10],
  ["commercial", "Commercial Impact", 10]
];
const DIRECTOR_PILLARS = [
  ["quality", "Filmography Quality & Consistency", 40],
  ["awards", "Awards & Festivals Prestige", 25],
  ["commercial", "Commercial Impact", 15],
  ["versatility", "Authorship & Versatility", 10],
  ["legacy", "Cultural Legacy", 10]
];

function isScoredActor(actor) {
  return actor && actor.pillars && Number.isFinite(actor.score);
}

function actorProfileUrl(actor, entity) {
  const slug = actor.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const prefix = entity === "director" ? "/directors" : "";
  return `${window.location.origin}${prefix}/${slug}-${actor.id}/details`;
}

function Brand() {
  return (
    <span className="ani-embed-brand" aria-label="ANI Index">
      <img src="/favicon.svg" alt="" />
      <span><strong>ANI</strong><small>INDEX</small></span>
    </span>
  );
}

function EmbedHeader({ actor, compact, profileUrl }) {
  return (
    <header className={`ani-embed-header${compact ? " is-compact" : ""}`}>
      {!compact && (
        actor.profile
          ? <img className="ani-embed-photo" src={`https://image.tmdb.org/t/p/w185${actor.profile}`} alt={actor.name} />
          : <div className="ani-embed-photo ani-embed-photo-empty" aria-hidden="true">{actor.name.slice(0, 1)}</div>
      )}
      {!compact && <h1 className="ani-embed-name">{actor.name}</h1>}
      <Brand />
      <ScoreBadge score={actor.score} size={48} />
      {!compact && (
        <a className="ani-embed-profile-link" href={profileUrl} target="_blank" rel="noreferrer">
          Full profile
        </a>
      )}
    </header>
  );
}

export default function ActorEmbed({ id, view, entity = "actor", compact }) {
  const [actor, setActor] = useState(null);
  const [error, setError] = useState("");
  const isDirector = entity === "director";
  const pillars = isDirector ? DIRECTOR_PILLARS : ACTOR_PILLARS;

  useLayoutEffect(() => {
    document.documentElement.classList.add("embed-mode");
    document.body.classList.add("embed-mode");
    return () => {
      document.documentElement.classList.remove("embed-mode");
      document.body.classList.remove("embed-mode");
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadActor() {
      setActor(null);
      setError("");

      const cached = isDirector
        ? getCachedDirector(id)
        : getDynamicCachedActor(id) || getCachedActor(id);
      if (isScoredActor(cached)) {
        if (active) setActor(cached);
        return;
      }

      try {
        const seedResponse = await fetch(isDirector ? "/seed-directors.json" : "/seed-actors.json");
        if (seedResponse.ok) {
          const seeds = await seedResponse.json();
          const seedActor = seeds.find((candidate) => Number(candidate.id) === id);
          if (isScoredActor(seedActor)) {
            if (active) setActor(seedActor);
            return;
          }
        }
      } catch {
        // A missing seed file does not prevent the on-demand API calculation.
      }

      try {
        const response = await fetch(`/api/${isDirector ? "directors" : "actors"}/${id}`);
        if (!response.headers.get("content-type")?.includes("application/json")) {
          throw new Error("The scoring API did not return JSON. Check the Netlify API redirects.");
        }
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.detail || result.message || result.error || `Request failed (${response.status})`);
        }
        if (!isScoredActor(result)) throw new Error("The actor response did not contain a valid score.");
        if (isDirector) cacheDirector(result);
        else {
          cacheActor(result);
          cacheDynamicActor(result);
        }
        if (active) setActor(result);
      } catch (loadError) {
        if (active) setError(loadError.message || "Request failed");
      }
    }

    loadActor();
    return () => { active = false; };
  }, [id, isDirector]);

  useEffect(() => {
    const sendHeight = () => {
      window.parent.postMessage({
        type: "ani-embed-resize",
        height: document.body.scrollHeight,
        id
      }, "*");
    };
    const frame = window.requestAnimationFrame(sendHeight);
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(sendHeight);
    observer?.observe(document.body);
    window.addEventListener("resize", sendHeight);
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", sendHeight);
    };
  }, [actor, error, id]);

  return (
    <main className={`ani-embed-root${view === "details" ? " is-details" : " is-badge"}`}>
      {!actor && !error && (
        <div className="ani-embed-status" role="status">
          <Loader2 className="animate-spin" size={20} />
          <span>Calculating ANI Index…</span>
        </div>
      )}
      {error && (
        <div className="ani-embed-error" role="alert">
          <strong>ANI Index unavailable</strong>
          <span>Could not calculate the index for TMDb {isDirector ? "director" : "actor"} {id}.</span>
          <small>{error}</small>
        </div>
      )}
      {actor && (
        <>
          <EmbedHeader actor={actor} compact={compact && view === "ani"} profileUrl={actorProfileUrl(actor, entity)} />
          {view === "details" && (
            <section className="ani-embed-breakdown" aria-label="Score breakdown">
              <h2>Score breakdown</h2>
              <p className="ani-embed-metrics">
                {actor.valid_work_count ?? 0} {isDirector ? "valid feature films" : "valid works"}
                {isDirector
                  ? ` · ${actor.written_movie_count ?? 0} written/co-written`
                  : ` · ${actor.lead_movie_count ?? 0} lead movies`}
                {" · "}{actor.award_count ?? 0} counted awards
              </p>
              <div className="ani-embed-pillars">
                {pillars.map(([key, label, weight]) => {
                  const value = actor.pillars[key];
                  return (
                    <div className="ani-embed-pillar" key={key}>
                      <div className="ani-embed-pillar-label">
                        <span>{label} <small>({weight}%)</small></span>
                        <strong>{value == null ? "N/A" : value}</strong>
                      </div>
                      <div className="ani-embed-progress" aria-label={`${label}: ${value ?? 0}%`}>
                        <span style={{ width: `${value ?? 0}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              <a className="ani-embed-profile-link" href={actorProfileUrl(actor, entity)} target="_blank" rel="noreferrer">
                Open full profile
              </a>
            </section>
          )}
        </>
      )}
    </main>
  );
}
