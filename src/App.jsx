import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X, Columns2 } from "lucide-react";
import SearchBar from "./components/SearchBar.jsx";
import ActorCard from "./components/ActorCard.jsx";
import ActorModal from "./components/ActorModal.jsx";
import CriteriaModal from "./components/CriteriaModal.jsx";
import CompareView from "./components/CompareView.jsx";
import { cacheActor, getCachedActor, getCachedActors } from "./utils/actorCache.js";

const API = "";

export default function App() {
  const [actors, setActors] = useState([]);
  const [castActors, setCastActors] = useState([]);
  const [movie, setMovie] = useState(null);
  const [sort, setSort] = useState("top");
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [criteria, setCriteria] = useState(false);
  const [comparisonOpen, setComparisonOpen] = useState(false);

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

  const openActor = async (id) => {
    setError(""); setLoading("Calculating this actor’s score… this can take up to 20 seconds.");
    const cached = getCachedActor(id);
    if (cached && cached.scoring_version === 16) {
      setSelected(cached);
      setLoading("");
      return;
    }
    try {
      const r = await fetch(`${API}/api/actors/${id}`);
      if (!r.ok) throw new Error((await r.json()).detail || "Request failed");
      const a = await r.json();
      cacheActor(a);
      setActors((p) => (p.some((x) => x.id === a.id) ? p : [...p, a]));
      setSelected(a);
    } catch (e) { setError("Could not load this actor: " + e.message); }
    setLoading("");
  };

  const pickMovie = async (m) => {
    setSelected(null); setError(""); setLoading(`Loading the cast of ${m.title}…`);
    try {
      const r = await fetch(`${API}/api/movies/${m.id}/cast`);
      if (!r.ok) throw new Error((await r.json()).detail || "Request failed");
      const d = await r.json();
      const cachedActors = d.actors || [];
      setMovie(d.movie); setCastActors(cachedActors);
      setActors((p) => [...p, ...cachedActors.filter((a) => !p.some((x) => x.id === a.id))]);
      const uncached = d.missing || [];
      await Promise.all(uncached.map(async (id) => {
        try {
          const actorResponse = await fetch(`${API}/api/actors/${id}`);
          if (!actorResponse.ok) return;
          const actor = await actorResponse.json();
          cacheActor(actor);
          setCastActors((current) => current.some((item) => item.id === actor.id) ? current : [...current, actor]);
          setActors((current) => current.some((item) => item.id === actor.id) ? current : [...current, actor]);
        } catch {}
      }));
    } catch (e) { setError("Could not load this movie: " + e.message); }
    setLoading("");
  };

  const onPick = (it) => (it.type === "Actor" ? openActor(it.id) : pickMovie({ id: it.id, title: it.name }));

  const shown = useMemo(() => {
    const list = [...(movie ? castActors : actors)];
    return list.sort(sort === "az" ? (a, b) => a.name.localeCompare(b.name) : (a, b) => b.score - a.score);
  }, [actors, castActors, movie, sort]);

  return (
    <div className="min-h-screen">
      <header className="px-4 pb-6 pt-14 text-center">
        <h1 className="mb-8 text-4xl font-extrabold tracking-tight sm:text-5xl">Who really can act?</h1>
        <div className="mx-auto flex w-full max-w-3xl flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><SearchBar api={API} onPick={onPick} onError={(message) => setError(`Could not search: ${message}`)} /></div>
          <button onClick={() => setComparisonOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-sky-400/60 bg-sky-400/10 px-5 py-3 text-sm font-bold text-sky-300 hover:bg-sky-400/20">
            <Columns2 size={18} /> Compare
          </button>
        </div>
        <div className="mt-6 inline-flex rounded-full border border-line bg-card p-1" role="tablist">
          {[["top", "Top Rated"], ["az", "A–Z"]].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={sort === k} onClick={() => setSort(k)}
                    className={`rounded-full px-5 py-2 text-sm font-bold transition ${sort === k ? "bg-sky-400 text-sky-950" : "text-slate-300 hover:text-white"}`}>{l}</button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16">
        {movie && (
          <div className="mb-5 flex justify-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-400/15 px-4 py-2 text-sm font-bold text-amber-300">
              Movie: {movie.title}
              <button onClick={() => { setMovie(null); setCastActors([]); }} aria-label="Clear movie filter"><X size={16} /></button>
            </span>
          </div>
        )}
        {error && <p className="mb-5 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-center text-sm text-red-300">{error}</p>}
        {loading && <p className="mb-5 flex items-center justify-center gap-2 text-slate-300"><Loader2 className="animate-spin" size={18} />{loading}</p>}
        {!loading && shown.length === 0 && <p className="text-center text-slate-500">No actors available. Try refreshing the page.</p>}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((a) => (
            <ActorCard key={a.id} actor={a} onOpen={setSelected} onMovie={pickMovie} />
          ))}
        </div>
      </main>

      <footer className="border-t border-line px-4 py-6">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 text-center">
          <button onClick={() => setCriteria(true)} className="text-sm text-slate-400 underline-offset-4 hover:text-white hover:underline">Criteria</button>
          <a href="https://www.themoviedb.org" target="_blank" rel="noreferrer" aria-label="The Movie Database" className="inline-flex items-center gap-3">
            <img src="/tmdb-short-blue.svg" alt="TMDb" className="h-8 w-auto" />
          </a>
          <p className="max-w-2xl text-xs text-slate-500">This product uses the TMDb API but is not endorsed or certified by TMDb.</p>
          <p className="text-xs text-slate-500">Awards data from Wikidata (CC0).</p>
        </div>
      </footer>

      {selected && <ActorModal actor={selected} onClose={() => setSelected(null)} onMovie={pickMovie} />}
      {criteria && <CriteriaModal onClose={() => setCriteria(false)} />}
      {comparisonOpen && <CompareView api={API} onClose={() => setComparisonOpen(false)} />}
    </div>
  );
}
