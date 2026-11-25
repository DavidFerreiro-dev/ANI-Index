import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X, Columns2, Hash } from "lucide-react";
import SearchBar from "./components/SearchBar.jsx";
import ActorCard from "./components/ActorCard.jsx";
import ActorModal from "./components/ActorModal.jsx";
import CriteriaModal from "./components/CriteriaModal.jsx";
import CompareView from "./components/CompareView.jsx";
import DirectorModal from "./components/DirectorModal.jsx";
import MovieModal from "./components/MovieModal.jsx";
import ActorEmbed from "./components/ActorEmbed.jsx";
import { cacheActor, getCachedActor, getCachedActors, cacheDirector, getCachedDirector, getCachedDirectors, purgeStaleAniCache } from "./utils/actorCache.js";

const API = "";

function getEmbedRoute(pathname) {
  const parts = pathname.split("/").filter(Boolean);
  const view = parts[parts.length - 1];
  if (view !== "ani" && view !== "details") return null;

  const isDirector = parts[0] === "directors";
  const actorParam = parts[parts.length - 2] || "";
  const match = actorParam.match(/(?:^|-)(\d+)$/);
  if (!match) return null;

  if (isDirector && parts.length !== 3) return null;
  if (!isDirector && parts.length !== 2) return null;
  return { id: Number(match[1]), view, entity: isDirector ? "director" : "actor" };
}

export default function App() {
  const route = getEmbedRoute(window.location.pathname);
  if (route) {
    return <ActorEmbed id={route.id} view={route.view} entity={route.entity} compact={new URLSearchParams(window.location.search).get("compact") === "true"} />;
  }
  return <MainApp />;
}

function getMovieRoute(pathname) {
  const match = pathname.match(/^\/movie\/(?:[^\/]+-)?(\d+)\/?$/);
  if (!match) return null;
  return Number(match[1]);
}

function MainApp() {
  const [actors, setActors] = useState([]);
  const [sort, setSort] = useState("top");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [selectedMovieId, setSelectedMovieId] = useState(() => getMovieRoute(window.location.pathname));
  const [criteria, setCriteria] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [mode, setMode] = useState("Actors");
  const [directors, setDirectors] = useState([]);
  const [isDetailedScore, setIsDetailedScore] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      const movieId = getMovieRoute(window.location.pathname);
      setSelectedMovieId(movieId);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const openMovie = useCallback((id, title = "") => {
    const slug = title ? `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${id}` : id;
    window.history.pushState({}, "", `/movie/${slug}`);
    setSelectedMovieId(id);
  }, []);

  const closeMovie = useCallback(() => {
    window.history.pushState({}, "", "/");
    setSelectedMovieId(null);
  }, []);

  useEffect(() => {
    purgeStaleAniCache();
  }, []);

  const loadActors = useCallback(async () => {
    const cached = getCachedActors();
    if (cached.length) setActors((seed) => {
      const merged = new Map(seed.map((actor) => [actor.id, actor]));
      for (const actor of cached) merged.set(actor.id, actor);
      return [...merged.values()];
    });
    try {
      const response = await fetch(`${API}/api/actors`);
      if (!response.ok) throw new Error("Ranking service unavailable");
      const liveActors = await response.json();
      setActors((seed) => {
        const merged = new Map(seed.map((actor) => [actor.id, actor]));
        for (const actor of liveActors) merged.set(actor.id, actor);
        return [...merged.values()];
      });
      liveActors.forEach(cacheActor);
    } catch {
      // The committed seed remains the complete fallback ranking.
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/seed-actors.json")
      .then((response) => response.ok ? response.json() : [])
      .then((seed) => {
        if (active) setActors((current) => {
          const merged = new Map(seed.map((actor) => [actor.id, actor]));
          for (const actor of current) merged.set(actor.id, actor);
          return [...merged.values()];
        });
      })
      .catch(() => {});
    loadActors();
    return () => { active = false; };
  }, [loadActors]);

  const loadDirectors = useCallback(async () => {
    const cached = getCachedDirectors();
    if (cached.length) setDirectors((seed) => {
      const merged = new Map(seed.map((director) => [director.id, director]));
      for (const director of cached) merged.set(director.id, director);
      return [...merged.values()];
    });
    try {
      const response = await fetch(`${API}/api/directors`);
      if (!response.ok) throw new Error("Ranking service unavailable");
      const liveDirectors = await response.json();
      setDirectors((seed) => {
        const merged = new Map(seed.map((director) => [director.id, director]));
        for (const director of liveDirectors) merged.set(director.id, director);
        return [...merged.values()];
      });
      liveDirectors.forEach(cacheDirector);
    } catch {
      // The committed seed remains the complete fallback ranking.
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/seed-directors.json")
      .then((response) => response.ok ? response.json() : [])
      .then((seed) => {
        if (active) setDirectors((current) => {
          const merged = new Map(seed.map((director) => [director.id, director]));
          for (const director of current) merged.set(director.id, director);
          return [...merged.values()];
        });
      })
      .catch(() => {});
    loadDirectors();
    return () => { active = false; };
  }, [loadDirectors]);

  const openActor = async (id, actorObj = null) => {
    setError("");
    const numId = Number(id);
    if (actorObj && actorObj.pillars && actorObj.score) {
      setSelected(actorObj);
      return;
    }
    const memActor = actors.find((a) => a.id === numId && a.pillars && a.score);
    if (memActor) {
      setSelected(memActor);
      return;
    }
    const cached = getCachedActor(numId);
    if (cached && cached.pillars && cached.score) {
      setSelected(cached);
      return;
    }
    setLoading("Calculating this actor’s score… this can take up to 20 seconds.");
    try {
      const r = await fetch(`${API}/api/actors/${numId}`);
      if (!r.ok) throw new Error((await r.json()).detail || "Request failed");
      const a = await r.json();
      cacheActor(a);
      setActors((p) => (p.some((x) => x.id === a.id) ? p.map((x) => (x.id === a.id ? a : x)) : [...p, a]));
      setSelected(a);
    } catch (e) { setError("Could not load this actor: " + e.message); }
    setLoading("");
  };

  const openDirector = async (id, directorObj = null) => {
    setError("");
    const numId = Number(id);
    if (directorObj && directorObj.pillars && directorObj.score) {
      setSelected(directorObj);
      return;
    }
    const memDirector = directors.find((d) => d.id === numId && d.pillars && d.score);
    if (memDirector) {
      setSelected(memDirector);
      return;
    }
    const cached = getCachedDirector(numId);
    if (cached && cached.pillars && cached.score) {
      setSelected(cached);
      return;
    }
    setLoading("Calculating this director’s score…");
    try {
      const response = await fetch(`${API}/api/directors/${numId}`);
      if (!response.ok) throw new Error((await response.json()).detail || "Request failed");
      const director = await response.json();
      if (director.valid_work_count < 3) throw new Error("Director has fewer than 3 valid feature films");
      cacheDirector(director);
      setDirectors((current) => current.some((item) => item.id === director.id)
        ? current.map((item) => item.id === director.id ? director : item)
        : [...current, director]);
      setSelected(director);
    } catch (error) {
      setError("Could not load this director: " + error.message);
    }
    setLoading("");
  };

  const onPick = (it) => {
    if (it.type === "Actor") return openActor(it.id);
    if (it.type === "Director") return openDirector(it.id);
    if (it.type === "Movie") return openMovie(it.id, it.name);
  };

  const shown = useMemo(() => {
    const list = mode === "Directors" ? [...directors] : [...actors];
    return list.sort(sort === "az" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.score - a.score);
  }, [actors, sort, mode, directors]);

  return (
    <div className="min-h-screen overflow-x-clip">
      <header className="relative z-40 w-full max-w-7xl mx-auto px-4 pb-6 pt-8 sm:pt-14 text-center">
        <h1 className="mb-2 text-3xl font-extrabold tracking-tight sm:mb-3 sm:text-5xl">{mode === "Directors" ? "Who really can direct?" : "Who really can act?"}</h1>
        <p className="mb-5 sm:mb-7 text-xs sm:text-sm font-medium tracking-wide text-slate-400">
          Powered by the <span className="text-sky-400 font-semibold cursor-help" title="Artistic & Narrative Index">ANI Index</span> <span className="text-slate-500 font-normal hidden sm:inline">(Artistic &amp; Narrative Index)</span>
        </p>
        <div className="mb-5 inline-flex max-w-full rounded-full border border-line bg-card p-1 shadow-inner" role="tablist" aria-label="Ranking type">
          {["Actors", "Directors"].map((tab) => (
            <button key={tab} role="tab" aria-selected={mode === tab} onClick={() => { setMode(tab); setSelected(null); }}
                    className={`rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold transition ${mode === tab ? "bg-sky-400 text-sky-950 shadow" : "text-slate-300 hover:text-white"}`}>{tab}</button>
          ))}
        </div>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="relative z-50 min-w-0 flex-1"><SearchBar key={mode} api={API} mode={mode} onPick={onPick} onError={(message) => setError(`Could not search: ${message}`)} /></div>
          <button onClick={() => setComparisonOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/60 bg-sky-400/10 px-5 py-2.5 sm:py-3 text-sm font-bold text-sky-300 hover:bg-sky-400/20 transition">
            <Columns2 size={18} /> Compare
          </button>
        </div>
        <div className="mt-5 sm:mt-6 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex max-w-full rounded-full border border-line bg-card p-1 shadow-inner" role="tablist">
            {[["top", "Top Rated"], ["az", "A–Z"]].map(([k, l]) => (
              <button key={k} role="tab" aria-selected={sort === k} onClick={() => setSort(k)}
                      className={`rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold transition ${sort === k ? "bg-sky-400 text-sky-950 shadow" : "text-slate-300 hover:text-white"}`}>{l}</button>
            ))}
          </div>
          <button type="button" role="switch" aria-checked={isDetailedScore}
                  onClick={() => setIsDetailedScore((value) => !value)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-xs sm:text-sm font-bold transition ${isDetailedScore ? "border-sky-400 bg-sky-400/15 text-sky-300" : "border-line bg-slate-900 text-slate-300 hover:text-white"}`}>
            <Hash size={16} /> Detailed Score
          </button>
        </div>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-4 pb-16">
        {error && <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center text-sm text-red-300">{error}</p>}
        {loading && <p className="mb-5 flex items-center justify-center gap-2 text-slate-300"><Loader2 className="animate-spin" size={18} />{loading}</p>}
        {!loading && shown.length === 0 && <p className="text-center text-slate-500">No {mode === "Directors" ? "directors" : "actors"} available. Try refreshing the page.</p>}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((a) => (
            <ActorCard
              key={a.id}
              actor={a}
              mode={mode}
              isDetailed={isDetailedScore}
              onOpen={(item) => (mode === "Directors" ? openDirector(item.id, item) : openActor(item.id, item))}
              onOpenMovie={(movieId, title) => openMovie(movieId, title)}
            />
          ))}
        </div>
      </main>

      <footer className="border-t border-line px-4 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
          <button onClick={() => setCriteria(true)} className="text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline">Criteria</button>
          <div className="flex flex-wrap items-center justify-center gap-5">
            <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" aria-label="The Movie Database">
              <img src="/tmdb-short-blue.svg" alt="TMDb" className="h-10 sm:h-11 w-auto" />
            </a>
            <a href="https://www.imdb.com" target="_blank" rel="noreferrer" aria-label="IMDb">
              <img src="/IMDB_Logo_2016.svg" alt="IMDb" className="h-9 sm:h-10 w-auto" />
            </a>
          </div>
          <p className="max-w-2xl text-xs text-slate-500">This product uses the TMDb API but is not endorsed or certified by TMDb.</p>
          <p className="max-w-2xl text-xs text-slate-500">Ratings and vote data courtesy of IMDb (imdb.com). This site is not affiliated with, endorsed by, or sponsored by IMDb.com, Inc. or its affiliates.</p>
          <p className="text-xs text-slate-500">Awards data from Wikidata (CC0).</p>
        </div>
      </footer>

      {selected && (mode === "Directors"
        ? <DirectorModal director={selected} isDetailed={isDetailedScore} onClose={() => setSelected(null)} onOpenMovie={(movieId, title) => openMovie(movieId, title)} />
        : <ActorModal actor={selected} isDetailed={isDetailedScore} onClose={() => setSelected(null)} onOpenMovie={(movieId, title) => openMovie(movieId, title)} />)}
      {selectedMovieId && (
        <MovieModal
          movieId={selectedMovieId}
          onClose={closeMovie}
          onSelectPerson={({ id, type }) => {
            closeMovie();
            if (type === "Director") {
              setMode("Directors");
              openDirector(id);
            } else {
              setMode("Actors");
              openActor(id);
            }
          }}
        />
      )}
      {criteria && <CriteriaModal mode={mode} onClose={() => setCriteria(false)} />}
      {comparisonOpen && <CompareView api={API} mode={mode} isDetailed={isDetailedScore} onClose={() => setComparisonOpen(false)} />}
    </div>
  );
}
