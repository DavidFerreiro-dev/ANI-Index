import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X, Columns2 } from "lucide-react";
import ScoreBadge from "./ScoreBadge.jsx";
import { cacheActor, getCachedActor } from "../utils/actorCache.js";

const PILLARS = [
  ["quality", "Filmography Quality"],
  ["awards", "Awards Prestige"],
  ["versatility", "Genre Versatility"],
  ["sentiment", "Critical Sentiment"],
  ["commercial", "Commercial Impact"]
];

function ActorSearch({ api, side, actor, onSelect, onClear }) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setItems([]);
      setOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`${api}/api/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.detail || "Search failed");
        setItems((Array.isArray(data) ? data : []).filter((item) => item.type === "Actor"));
        setOpen(true);
      } catch {
        setItems([]);
        setOpen(false);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, api]);

  useEffect(() => {
    const close = (event) => {
      if (box.current && !box.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={box} className="relative mb-5">
      <Search className="absolute left-4 top-1/2 z-10 -translate-y-1/2 text-slate-400" size={18} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onFocus={() => items.length && setOpen(true)}
        placeholder="Search an actor..."
        aria-label={`${side} actor search`}
        className="w-full rounded-full border border-line bg-card py-3 pl-11 pr-11 text-sm outline-none focus:border-sky-400"
      />
      {actor && (
        <button onClick={onClear} aria-label={`Clear ${side}`} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      )}
      {busy && !actor && <Loader2 className="absolute right-4 top-1/2 animate-spin text-slate-400" size={18} />}
      {open && items.length > 0 && (
        <ul className="absolute z-40 mt-2 max-h-72 w-full overflow-auto rounded-2xl border border-line bg-card p-2 shadow-2xl">
          {items.map((item) => (
            <li key={item.id}>
              <button onClick={() => { setOpen(false); setQuery(""); onSelect(item); }}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-coal">
                {item.image
                  ? <img src={`https://image.tmdb.org/t/p/w92${item.image}`} alt="" className="h-14 w-10 rounded object-cover" />
                  : <div className="h-14 w-10 rounded bg-coal" />}
                <span className="font-medium">{item.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActorColumn({ api, side, actor, loading, onSelect, onClear, highlight }) {
  return (
    <section className="min-w-0 border-line lg:border-r lg:last:border-r-0">
      <ActorSearch api={api} side={side} actor={actor} onSelect={onSelect} onClear={onClear} />
      {loading && (
        <div className="grid min-h-[430px] place-items-center rounded-2xl border border-line bg-card">
          <div className="flex items-center gap-2 text-slate-300"><Loader2 className="animate-spin" size={20} />Loading actor...</div>
        </div>
      )}
      {!loading && !actor && (
        <div className="grid min-h-[430px] place-items-center rounded-2xl border border-dashed border-line text-slate-500">
          Search for an actor
        </div>
      )}
      {!loading && actor && (
        <div>
          {actor.profile
            ? <img src={`https://image.tmdb.org/t/p/w500${actor.profile}`} alt={actor.name} className="mx-auto h-72 w-48 rounded-2xl object-cover sm:h-80 sm:w-56" />
            : <div className="mx-auto grid h-72 w-48 place-items-center rounded-2xl bg-card text-slate-500">No photo</div>}
          <h2 className="mt-4 text-center text-2xl font-extrabold">{actor.name}</h2>
          <p className="mt-2 text-center text-xs text-slate-500">
            {actor.valid_work_count ?? "Unknown"} valid works · {actor.award_count ?? 0} counted acting awards
            {actor.lead_movie_count != null ? ` · ${actor.lead_movie_count} lead movies` : ""}
          </p>
          <div className="mt-3 flex justify-center"><ScoreBadge score={actor.score} size={72} /></div>

          <div className="mt-6 space-y-4">
            {PILLARS.map(([key, label]) => {
              const value = actor.pillars?.[key];
              const isWinner = value !== null && value !== undefined &&
                highlight[key] === actor.id;
              return (
                <div key={key} className={isWinner ? "rounded-xl border border-sky-400/50 bg-sky-400/5 p-3" : "p-3"}>
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-300">{label}</span>
                    <span className="font-bold">
                      {value == null
                        ? key === "sentiment" ? "Not enough review data" : "Not enough box office data"
                        : value}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-card">
                    <div className="h-full rounded-full bg-sky-400" style={{ width: `${value ?? 0}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <h3 className="mt-7 text-lg font-bold">Notable Awards</h3>
          {actor.awards_available === false
            ? <p className="mt-2 text-sm text-amber-300">Awards data unavailable for this actor.</p>
            : (actor.awards || []).filter((award) => ["S", "A", "B"].includes(award.tier)).length === 0
              ? <p className="mt-2 text-sm text-slate-500">No notable awards found.</p>
              : <ul className="mt-2 space-y-1 text-sm">
                  {(actor.awards || []).filter((award) => ["S", "A", "B"].includes(award.tier)).slice(0, 8).map((award) => (
                    <li key={`${award.label}-${award.role}`} className="border-b border-line py-2">
                      <span>{award.label}</span>
                      <span className="block text-slate-400">{award.role === "supporting" ? "Supporting" : "Lead"} · {award.won ? `${award.won} won` : ""}{award.won && award.nominated ? ", " : ""}{award.nominated ? `${award.nominated} nominated` : ""}</span>
                    </li>
                  ))}
                </ul>}

          <h3 className="mt-7 text-lg font-bold">Top Lead Projects</h3>
          <ul className="mt-2 space-y-1">
            {(actor.leads || []).slice(0, 6).map((project) => (
              <li key={project.id} className="flex justify-between gap-3 rounded-lg px-3 py-2 text-sm hover:bg-card">
                <span>{project.title}{project.year ? ` (${project.year})` : ""}</span>
                <span className="text-slate-400">{project.rating}</span>
              </li>
            ))}
            {(!actor.leads || actor.leads.length === 0) && <li className="text-sm text-slate-500">No lead roles found</li>}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function CompareView({ api, onClose, initialActors = [] }) {
  const [left, setLeft] = useState(initialActors[0] || null);
  const [right, setRight] = useState(initialActors[1] || null);
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);

  const loadActor = async (item, side) => {
    const cached = getCachedActor(item.id);
    if (cached) {
      side === "left" ? setLeft(cached) : setRight(cached);
      return;
    }
    side === "left" ? setLeftLoading(true) : setRightLoading(true);
    try {
      const response = await fetch(`${api}/api/actors/${item.id}`);
      if (!response.ok) throw new Error("Could not load actor");
      const actor = await response.json();
      cacheActor(actor);
      side === "left" ? setLeft(actor) : setRight(actor);
    } finally {
      side === "left" ? setLeftLoading(false) : setRightLoading(false);
    }
  };

  const highlight = {};
  PILLARS.forEach(([key]) => {
    const leftValue = left?.pillars?.[key];
    const rightValue = right?.pillars?.[key];
    if (leftValue != null && rightValue != null && leftValue !== rightValue) {
      highlight[key] = leftValue > rightValue ? left.id : right.id;
    }
  });

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-coal p-4 sm:p-8">
      <header className="mx-auto mb-6 flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-3">
          <Columns2 size={24} className="text-sky-400" />
          <h1 className="text-2xl font-extrabold">Compare actors</h1>
        </div>
        <button onClick={onClose} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-bold hover:bg-card">
          <X size={17} /> Close
        </button>
      </header>
      <main className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
        <ActorColumn api={api} side="Actor A" actor={left} loading={leftLoading}
                     onSelect={(item) => loadActor(item, "left")} onClear={() => setLeft(null)} highlight={highlight} />
        <ActorColumn api={api} side="Actor B" actor={right} loading={rightLoading}
                     onSelect={(item) => loadActor(item, "right")} onClear={() => setRight(null)} highlight={highlight} />
      </main>
    </div>
  );
}
