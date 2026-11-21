import { X } from "lucide-react";
import { useEffect, useState } from "react";
import ScoreBadge from "./ScoreBadge.jsx";

export default function ActorModal({ actor, onClose, onMovie }) {
  const [config, setConfig] = useState(null);
  useEffect(() => {
    fetch("/api/config").then((response) => response.ok ? response.json() : null).then(setConfig).catch(() => {});
  }, []);
  const weights = config?.WEIGHTS || { quality: 0.40, awards: 0.30, versatility: 0.10, sentiment: 0.10, commercial: 0.10 };
  const pillars = [
    ["quality", "Filmography Quality", weights.quality],
    ["awards", "Awards Prestige", weights.awards],
    ["versatility", "Genre Versatility", weights.versatility],
    ["sentiment", "Critical Sentiment", weights.sentiment],
    ["commercial", "Commercial Impact", weights.commercial],
  ];
  const notable = (actor.awards || []).filter((a) => a.tier === "S" || a.tier === "A" || a.tier === "B");
  const leadAwards = notable.filter((award) => award.role === "lead");
  const supportingAwards = notable.filter((award) => award.role === "supporting");
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-auto bg-black/75 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={actor.name} onClick={(e) => e.stopPropagation()}
           className="relative my-8 w-full max-w-3xl rounded-3xl border border-line bg-coal p-6 sm:p-8">
        <button onClick={onClose} aria-label="Close" className="absolute right-4 top-4 rounded-full p-2 hover:bg-card"><X size={22} /></button>
        <div className="flex gap-5">
          {actor.profile && <img src={`https://image.tmdb.org/t/p/w500${actor.profile}`} alt={actor.name} className="h-48 w-32 rounded-xl object-cover sm:h-60 sm:w-40" />}
          <div className="min-w-0">
            <h2 className="text-3xl font-extrabold">{actor.name}</h2>
            <div className="mt-3"><ScoreBadge score={actor.score} size={72} /></div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{actor.summary ? actor.summary + (actor.summary.length >= 320 ? "…" : "") : "No biography available."}</p>
          </div>
        </div>

        <h3 className="mt-8 text-lg font-bold">Score breakdown</h3>
        <p className="mt-2 text-xs text-slate-500">
          Based on {actor.valid_work_count ?? "unknown"} valid works
          {actor.lead_movie_count != null ? `, ${actor.lead_movie_count} lead movies` : ""}
          {actor.director_movie_count ? `, including ${actor.director_movie_count} directed by a curated prestige director` : ""}
          , and {actor.award_count ?? 0} counted acting awards.
        </p>
        <div className="mt-3 space-y-3">
          {pillars.map(([k, label, w]) => {
            const v = actor.pillars[k];
            return (
              <div key={k}>
                <div className="flex justify-between text-sm"><span>{label} <span className="text-slate-500">({Math.round(w * 100)}%)</span></span>
                  <span className="font-bold">{v === null ? "Not enough review data" : v}</span></div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-card">
                  <div className="h-full rounded-full bg-sky-400" style={{ width: `${v ?? 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {actor.pillars?.sentiment === null && (
          <p className="mt-3 text-sm text-amber-300">Not enough review data (score capped at 89)</p>
        )}
        {(actor.ignored_awards?.length || 0) > 0 && (
          <p className="mt-3 text-sm text-slate-400">
            Other awards found: {actor.ignored_awards.length}
          </p>
        )}
        {actor.pillars?.commercial === null && (
          <p className="mt-3 text-sm text-amber-300">Not enough box office data</p>
        )}

        <h3 className="mt-8 text-lg font-bold">Notable awards</h3>
        {actor.awards_available === false ? (
          <p className="mt-2 text-sm text-amber-300">Awards data unavailable for this actor.</p>
        ) : (
          <div className="mt-2 grid gap-5 sm:grid-cols-2">
            {[["Lead", leadAwards], ["Supporting", supportingAwards]].map(([title, awards]) => (
              <div key={title}>
                <h4 className="mb-1 text-sm font-bold text-slate-200">{title}</h4>
                {awards.length === 0 ? <p className="text-sm text-slate-500">No notable awards found.</p> : (
                  <ul className="space-y-1 text-sm">
                    {awards.slice(0, 8).map((a) => (
                      <li key={`${a.label}-${a.role}`} className="border-b border-line py-1.5">
                        <span>{a.label}</span>
                        <span className="block text-slate-400">{a.won > 0 && `${a.won} won`}{a.won > 0 && a.nominated > 0 && ", "}{a.nominated > 0 && `${a.nominated} nominated`}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}

        {actor.curated_notes?.length > 0 && (
          <>
            <h3 className="mt-8 text-lg font-bold">Historical notes</h3>
            <div className="mt-2 space-y-2">
              {actor.curated_notes.map((note, index) => (
                <p key={index} className="rounded-lg border border-line p-3 text-sm text-slate-300">
                  {note.text}
                  {note.source && <span className="mt-1 block text-xs text-slate-500">Source: {note.source}</span>}
                </p>
              ))}
            </div>
          </>
        )}

        <h3 className="mt-8 text-lg font-bold">Critical excerpts</h3>
        {actor.excerpts.length === 0 ? <p className="mt-2 text-sm text-slate-500">Not enough reviews mention this actor.</p> : (
          <div className="mt-2 space-y-3">
            {actor.excerpts.map((e, i) => (
              <blockquote key={i} className="border-l-2 border-sky-400 pl-4 text-sm italic text-slate-300">
                “{e.text}”<footer className="mt-1 text-xs not-italic text-slate-500">Review of {e.movie}</footer>
              </blockquote>
            ))}
          </div>
        )}

        <h3 className="mt-8 text-lg font-bold">Top lead roles</h3>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {actor.leads.map((m) => (
            <li key={m.id}>
              <button onClick={() => onMovie({ id: m.id, title: m.title })}
                      className="flex w-full justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-card">
                <span className="truncate">{m.title}{m.year && <span className="text-slate-500"> ({m.year})</span>}</span>
                <span className="text-slate-400">{m.rating}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
