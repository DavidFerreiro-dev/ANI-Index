import React, { useEffect, useState, useRef } from "react";
import { X, Star, Calendar, Clock, Film, Loader2, Sparkles, ExternalLink } from "lucide-react";
import ScoreBadge from "./ScoreBadge.jsx";
import { loadImdbRatings } from "../utils/imdbRatings.js";
import { getCachedActor, cacheActor, getCachedDirector, cacheDirector } from "../utils/actorCache.js";

// Official SVG logos from public/
const IMDB_LOGO = "/IMDB_Logo_2016.svg";
const TMDB_LOGO = "/tmdb-short-blue.svg";

// Seed data: preloaded from public/ at module load time (lazy, one fetch each)
let _seedActors = null;
let _seedDirectors = null;
async function getSeedActors() {
  if (_seedActors) return _seedActors;
  try { _seedActors = await fetch("/seed-actors.json").then(r => r.json()); } catch { _seedActors = []; }
  return _seedActors;
}
async function getSeedDirectors() {
  if (_seedDirectors) return _seedDirectors;
  try { _seedDirectors = await fetch("/seed-directors.json").then(r => r.json()); } catch { _seedDirectors = []; }
  return _seedDirectors;
}

// Concurrency queue for background on-the-fly ANI Index calculation (max 2-3 concurrent)
class RequestQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  add(fn) {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processNext();
    });
  }

  processNext() {
    if (this.running >= this.concurrency || this.queue.length === 0) return;
    const { fn, resolve, reject } = this.queue.shift();
    this.running++;
    fn()
      .then(resolve)
      .catch(reject)
      .finally(() => {
        this.running--;
        this.processNext();
      });
  }
}

const calculationQueue = new RequestQueue(2);

export default function MovieModal({ movieId, mediaType = "movie", onClose, onSelectPerson }) {
  const isTv = mediaType === "tv";
  const numericMovieId = typeof movieId === "string" ? (movieId.match(/(?:^|-)(\d+)$/)?.[1] || movieId) : movieId;
  const [movie, setMovie] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imdbData, setImdbData] = useState(null);
  const [aniScores, setAniScores] = useState({}); // { [id]: { score, loading, error, entity } }
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Fetch movie or TV series data and IMDb ratings
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    async function loadData() {
      try {
        const idToFetch = Number(numericMovieId);
        if (!idToFetch || Number.isNaN(idToFetch)) {
          throw new Error(isTv ? "Invalid TV series ID" : "Invalid movie ID");
        }

        const primaryUrl = isTv ? `/api/tv/${idToFetch}` : `/api/movies/${idToFetch}`;
        const fnUrl = isTv ? `/.netlify/functions/tv/${idToFetch}` : `/.netlify/functions/movies/${idToFetch}`;
        const queryUrl = isTv ? `/.netlify/functions/tv?id=${idToFetch}` : `/.netlify/functions/movie?id=${idToFetch}`;

        let movieRes = await fetch(primaryUrl).catch(() => null);
        if (!movieRes || !movieRes.ok) {
          movieRes = await fetch(fnUrl).catch(() => null);
        }
        if (!movieRes || !movieRes.ok) {
          movieRes = await fetch(queryUrl).catch(() => null);
        }

        if (!movieRes || !movieRes.ok) {
          throw new Error(isTv ? "Could not load TV series details" : "Could not load movie details");
        }

        const data = await movieRes.json();
        if (!active) return;
        setMovie(data);

        // Load IMDb ratings asynchronously in background so it never blocks the title from showing
        loadImdbRatings()
          .then((ratingsDataset) => {
            if (!active || !data.imdb_id || !ratingsDataset) return;
            const imdbEntry = ratingsDataset[data.imdb_id];
            if (imdbEntry) {
              setImdbData({ rating: imdbEntry[0], votes: imdbEntry[1] });
            }
          })
          .catch(() => {});
      } catch (err) {
        if (active) setError(err.message || (isTv ? "Failed to load TV series" : "Failed to load movie"));
      } finally {
        if (active) setLoading(false);
      }
    }

    loadData();
    return () => { active = false; };
  }, [numericMovieId, isTv]);

  // Queue background ANI Index calculations for directors and cast members
  // NEVER re-calculate for people already in seed-actors.json / seed-directors.json or localStorage.
  useEffect(() => {
    if (!movie) return;

    const peopleToProcess = [
      ...(movie.directors || []).map((d) => ({ id: d.id, name: d.name, entity: "director" })),
      ...(movie.cast || []).map((c) => ({ id: c.id, name: c.name, entity: "actor" }))
    ];

    // Load seeds in parallel, then process
    Promise.all([getSeedActors(), getSeedDirectors()]).then(([seedActors, seedDirs]) => {
      const seedActorMap = new Map((seedActors || []).map((a) => [a.id, a]));
      const seedDirMap = new Map((seedDirs || []).map((d) => [d.id, d]));

      peopleToProcess.forEach(({ id, entity }) => {
        // 1. Check seed JSON first (pre-computed scores — never re-calculate)
        const seed = entity === "director" ? seedDirMap.get(id) : seedActorMap.get(id);
        if (seed && typeof seed.score === "number") {
          setAniScores((prev) => ({
            ...prev,
            [`${entity}-${id}`]: { score: seed.score, loading: false }
          }));
          return;
        }

        // 2. Check localStorage cache
        const cached = entity === "director" ? getCachedDirector(id) : getCachedActor(id);
        if (cached && typeof cached.score === "number") {
          setAniScores((prev) => ({
            ...prev,
            [`${entity}-${id}`]: { score: cached.score, loading: false }
          }));
          return;
        }

        // 3. Unknown person → queue live calculation
        setAniScores((prev) => ({
          ...prev,
          [`${entity}-${id}`]: { score: null, loading: true }
        }));

        calculationQueue.add(async () => {
          try {
            const endpoint = entity === "director" ? `/api/directors/${id}` : `/api/actors/${id}`;
            const res = await fetch(endpoint);
            if (!res.ok) throw new Error("API calculation failed");
            const data = await res.json();

            if (entity === "director") cacheDirector(data);
            else cacheActor(data);

            if (isMountedRef.current) {
              setAniScores((prev) => ({
                ...prev,
                [`${entity}-${id}`]: { score: data.score, loading: false }
              }));
            }
          } catch {
            if (isMountedRef.current) {
              setAniScores((prev) => ({
                ...prev,
                [`${entity}-${id}`]: { score: null, loading: false, error: true }
              }));
            }
          }
        });
      });
    });
  }, [movie]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="flex flex-col items-center gap-3 text-slate-300">
          <Loader2 className="animate-spin text-sky-400" size={40} />
          <p className="text-sm font-medium">Loading movie details...</p>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
        <div className="rounded-2xl border border-line bg-card p-6 text-center max-w-md w-full">
          <p className="text-rose-400 font-medium mb-4">{error || "Movie not found"}</p>
          <button onClick={onClose} className="rounded-xl bg-sky-500 hover:bg-sky-400 text-black px-4 py-2 font-bold text-sm">
            Close
          </button>
        </div>
      </div>
    );
  }

  const tmdbScore = Number(movie.vote_average) ? Number(movie.vote_average).toFixed(1) : "—";
  const tmdbVotes = Number(movie.vote_count) ? Number(movie.vote_count).toLocaleString() : "0";

  // IMDb data: prefer dataset (imdbData state) over server-side field (movie.imdb_rating)
  const rawImdbRating = imdbData?.rating ?? movie.imdb_rating ?? null;
  const rawImdbVotes  = imdbData?.votes  ?? movie.imdb_votes  ?? null;
  const imdbScore = rawImdbRating ? Number(rawImdbRating).toFixed(1) : null;
  const imdbVotes = rawImdbVotes  ? Number(rawImdbVotes).toLocaleString() : null;

  // Weighted Combined Score (75% IMDb / 25% TMDb for TV; 60% IMDb / 40% TMDb for Movies)
  const imdbWeight = isTv ? 0.75 : 0.6;
  const tmdbWeight = 1 - imdbWeight;
  const splitLabel = isTv ? "75/25" : "60/40";
  let combinedScore = null;
  if (rawImdbRating && movie.vote_average) {
    combinedScore = (imdbWeight * Number(rawImdbRating) + tmdbWeight * Number(movie.vote_average)).toFixed(1);
  } else if (movie.vote_average) {
    combinedScore = Number(movie.vote_average).toFixed(1);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="relative my-auto w-full max-w-4xl rounded-2xl border border-line bg-coal shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Blurred Backdrop Background */}
        {movie.backdrop_path && (
          <div className="absolute inset-0 z-0 h-72 w-full overflow-hidden opacity-25 pointer-events-none">
            <img
              src={`https://image.tmdb.org/t/p/w1280${movie.backdrop_path}`}
              alt=""
              className="h-full w-full object-cover blur-md scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-coal/80 to-coal" />
          </div>
        )}

        {/* Modal Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-20 rounded-full border border-line/60 bg-card/80 p-2 text-slate-300 hover:bg-card hover:text-white transition"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {/* Scrollable Content Body */}
        <div className="relative z-10 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* Header Section: Poster + Metadata */}
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            {/* Poster */}
            <div className="shrink-0 w-36 sm:w-48 aspect-[2/3] rounded-xl overflow-hidden border border-line shadow-xl bg-card mx-auto sm:mx-0">
              {movie.poster_path ? (
                <img
                  src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                  alt={movie.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="grid h-full place-items-center text-slate-500 text-xs">No Poster</div>
              )}
            </div>

            {/* Title, Year, Genres, Synopsis */}
            <div className="flex-1 space-y-3">
              <div>
                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  {movie.title}
                </h1>
                {movie.original_title && movie.original_title !== movie.title && (
                  <p className="text-xs sm:text-sm text-slate-400 italic mt-0.5">{movie.original_title}</p>
                )}
              </div>

              {/* Badges: Year/Years, Runtime or Seasons/Episodes, Genres */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                {(movie.years || movie.year) && (
                  <span className="flex items-center gap-1 rounded-md bg-card/70 border border-line px-2 py-1">
                    <Calendar size={13} className="text-sky-400" /> {movie.years || movie.year}
                  </span>
                )}
                {isTv ? (
                  (movie.number_of_seasons > 0 || movie.number_of_episodes > 0) && (
                    <span className="flex items-center gap-1 rounded-md bg-card/70 border border-line px-2 py-1">
                      <Film size={13} className="text-sky-400" /> {movie.number_of_seasons} {movie.number_of_seasons === 1 ? "temporada" : "temporadas"} · {movie.number_of_episodes} episodios
                    </span>
                  )
                ) : (
                  movie.runtime > 0 && (
                    <span className="flex items-center gap-1 rounded-md bg-card/70 border border-line px-2 py-1">
                      <Clock size={13} className="text-sky-400" /> {Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m
                    </span>
                  )
                )}
                {(movie.genres || []).map((g) => (
                  <span key={g.id} className="rounded-md bg-sky-950/40 border border-sky-800/40 px-2 py-1 text-sky-300 font-medium">
                    {g.name}
                  </span>
                ))}
              </div>

              {/* Overview / Synopsis */}
              {movie.overview && (
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
                  {movie.overview}
                </p>
              )}
            </div>
          </div>

          {/* Ratings block with the three ratings always visible */}
          <div className="rounded-2xl border border-line bg-card/50 p-4 sm:p-5 space-y-3">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Star size={14} className="text-amber-400 fill-amber-400" /> Official Ratings &amp; Consensus
              </h3>
            </div>

            {/* Ratings Display Content */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              {/* Combined Weighted Score */}
              {combinedScore && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-950/20 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-sky-300">Ponderada ({splitLabel})</span>
                    <Sparkles size={14} className="text-sky-400" />
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{combinedScore}</span>
                    <span className="text-xs text-slate-400">/ 10</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1">Rating directo IMDb/TMDb</span>
                </div>
              )}

              {/* IMDb Block */}
              <div className="rounded-xl border border-line/60 bg-coal/60 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <img src={IMDB_LOGO} alt="IMDb" className="h-4 w-auto" />
                    {movie.imdb_id && (
                      <a
                        href={`https://www.imdb.com/title/${movie.imdb_id}/`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-slate-500 hover:text-amber-400 transition"
                        title="Ver en IMDb"
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{imdbScore || "—"}</span>
                    <span className="text-xs text-slate-400">/ 10</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1">
                    {imdbVotes ? `${imdbVotes} votos` : "Datos no disponibles"}
                  </span>
              </div>

              {/* TMDb Block */}
              <div className="rounded-xl border border-line/60 bg-coal/60 p-3 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <img src={TMDB_LOGO} alt="TMDb" className="h-3.5 w-auto" />
                    <a
                      href={`https://www.themoviedb.org/${isTv ? "tv" : "movie"}/${movie.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-slate-500 hover:text-sky-400 transition"
                      title="Ver en TMDb"
                    >
                      <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-black text-white">{tmdbScore}</span>
                    <span className="text-xs text-slate-400">/ 10</span>
                  </div>
                  <span className="text-[11px] text-slate-400 mt-1">{tmdbVotes} votos</span>
              </div>
            </div>
          </div>

          {/* Direction / Creators Section */}
          {movie.directors?.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Film size={16} className="text-sky-400" /> {isTv ? "Creadores y Dirección" : "Dirección"}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {movie.directors.map((dir) => {
                  const state = aniScores[`director-${dir.id}`];
                  return (
                    <button
                      key={dir.id}
                      onClick={() => {
                        onClose();
                        onSelectPerson?.({ id: dir.id, name: dir.name, type: "Director" });
                      }}
                      className="flex items-center gap-3 rounded-xl border border-line/60 bg-card/40 p-3 text-left hover:border-sky-500/50 hover:bg-card/70 transition group"
                    >
                      <div className="h-12 w-12 rounded-full overflow-hidden bg-coal shrink-0 border border-line">
                        {dir.profile_path ? (
                          <img src={`https://image.tmdb.org/t/p/w185${dir.profile_path}`} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full place-items-center text-xs text-slate-500">Foto</div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm text-slate-200 group-hover:text-white truncate">{dir.name}</p>
                        <p className="text-xs text-slate-400">Director</p>
                      </div>
                      <div className="shrink-0 flex items-center gap-1">
                        {state?.loading ? (
                          <div className="flex items-center gap-1 rounded-full bg-sky-950/60 border border-sky-800/40 px-2 py-1 text-[11px] text-sky-400 animate-pulse">
                            <Loader2 size={11} className="animate-spin" /> ANI
                          </div>
                        ) : typeof state?.score === "number" ? (
                          <ScoreBadge score={state.score} size={40} />
                        ) : (
                          <span className="text-xs text-slate-500">—</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Cast Section with Real-Time ANI Index badges */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300">
              Reparto Principal &amp; ANI Index
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {(movie.cast || []).map((actor) => {
                const state = aniScores[`actor-${actor.id}`];
                return (
                  <button
                    key={actor.id}
                    onClick={() => {
                      onClose();
                      onSelectPerson?.({ id: actor.id, name: actor.name, type: "Actor" });
                    }}
                    className="flex items-center gap-3 rounded-xl border border-line/60 bg-card/40 p-2.5 text-left hover:border-sky-500/50 hover:bg-card/70 transition group"
                  >
                    <div className="h-11 w-11 rounded-full overflow-hidden bg-coal shrink-0 border border-line">
                      {actor.profile_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${actor.profile_path}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-[10px] text-slate-500">Foto</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-xs text-slate-200 group-hover:text-white truncate">{actor.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">{actor.character || "Cast"}</p>
                    </div>
                    <div className="shrink-0 flex items-center">
                      {state?.loading ? (
                        <div className="flex items-center gap-1 rounded-full bg-sky-950/60 border border-sky-800/40 px-2 py-0.5 text-[10px] text-sky-400 animate-pulse">
                          <Loader2 size={10} className="animate-spin" /> ANI
                        </div>
                      ) : typeof state?.score === "number" ? (
                        <ScoreBadge score={state.score} size={36} />
                      ) : (
                        <span className="text-[11px] text-slate-500">—</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

