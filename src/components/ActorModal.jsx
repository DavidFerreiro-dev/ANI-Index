import { X } from "lucide-react";
import { useEffect, useState } from "react";
import ScoreBadge from "./ScoreBadge.jsx";
import { formatAniScore } from "../utils/aniScore.js";

export default function ActorModal({ actor, onClose, isDetailed = false }) {
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
    <div className="fixed inset-0 z-40 flex items-center sm:items-start justify-center overflow-y-auto bg-black/80 p-2 sm:p-4 sm:py-8" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={actor.name} onClick={(e) => e.stopPropagation()}
           className="relative my-auto sm:my-8 w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-line bg-coal p-4 sm:p-8 max-w-4xl scroll-smooth shadow-2xl">
        <button onClick={onClose} aria-label="Close"
                className="sticky top-0 float-right -mr-1 -mt-1 sm:-mr-2 sm:-mt-2 z-20 rounded-full bg-coal/90 p-2 sm:p-2.5 backdrop-blur-md border border-line/70 text-slate-300 hover:text-white hover:bg-card transition shadow-md">
          <X size={20} />
        </button>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start text-center sm:text-left">
          {actor.profile ? (
            <img src={`https://image.tmdb.org/t/p/w500${actor.profile}`} alt={actor.name}
                 className="h-52 w-36 sm:h-64 sm:w-44 shrink-0 rounded-2xl object-cover object-top shadow-lg border border-line/40" />
          ) : (
            <div className="grid h-52 w-36 sm:h-64 sm:w-44 shrink-0 place-items-center rounded-2xl border border-line/40 bg-card text-slate-500">No photo</div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{actor.name}</h2>
            <div className="mt-3 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 justify-center sm:justify-start">
              <ScoreBadge score={actor.score} size={68} isDetailed={isDetailed} />
              {(actor.name === "Mikey Madison" || String(actor.id) === "2073800") ? (
                <div className="flex flex-col items-center sm:items-start">
                  <span className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-300 tracking-wide uppercase">
                    Anora Index
                  </span>
                  <span className="mt-0.5 text-[11px] italic text-amber-200/80">
                    Yes, this is where the name actually comes from.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col items-center sm:items-start">
                  <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-300 tracking-wide uppercase">
                    ANI Index
                  </span>
                </div>
              )}
            </div>
            <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-300">{actor.summary ? actor.summary + (actor.summary.length >= 320 ? "…" : "") : "No biography available."}</p>
          </div>
        </div>

        <h3 className="mt-7 sm:mt-8 text-base sm:text-lg font-bold text-white">Score breakdown</h3>
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
          Based on {actor.valid_work_count ?? "unknown"} valid works
          {actor.lead_movie_count != null ? `, ${actor.lead_movie_count} lead movies` : ""}
          {actor.director_movie_count ? `, including ${actor.director_movie_count} directed by a curated prestige director` : ""}
          , and {actor.award_count ?? 0} counted acting awards.
        </p>
        <div className="mt-3.5 space-y-3.5">
          {pillars.map(([k, label, w]) => {
            const v = actor.pillars?.[k];
            return (
              <div key={k}>
                <div className="flex justify-between text-sm sm:text-base">
                  <span className="font-semibold text-slate-200">{label} <span className="text-xs sm:text-sm font-normal text-slate-400">({Math.round(w * 100)}%)</span></span>
                  <span className="font-extrabold text-white">{v === null ? "Not enough review data" : formatAniScore(v, isDetailed)}</span>
                </div>
                <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-card">
                  <div className="h-full rounded-full bg-sky-400 transition-all duration-500" style={{ width: `${v ?? 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
        {actor.pillars?.sentiment === null && (
          <p className="mt-3 text-sm text-amber-300">Not enough review data (score capped at 89)</p>
        )}
        {(actor.ignored_awards?.length || 0) > 0 && (
          <details className="mt-3 text-xs sm:text-sm text-slate-400">
            <summary className="cursor-pointer font-medium hover:text-slate-200">Other awards found: {actor.ignored_awards.length}</summary>
            <ul className="mt-2 space-y-1 rounded-xl border border-line/60 bg-card/40 p-3 max-h-48 overflow-y-auto">
              {actor.ignored_awards.map((award, index) => (
                <li key={`${award.awardQid}-${award.label}-${index}`} className="break-words text-slate-300">
                  {award.label || "Unnamed award"} — {award.kind || "unknown"}{award.awardQid ? ` (${award.awardQid})` : ""}
                </li>
              ))}
            </ul>
          </details>
        )}
        {actor.pillars?.commercial === null && (
          <p className="mt-3 text-sm text-amber-300">Not enough box office data</p>
        )}

        <h3 className="mt-7 sm:mt-8 text-base sm:text-lg font-bold text-white">Notable awards</h3>
        {actor.awards_available === false ? (
          <p className="mt-2 text-sm text-amber-300">Awards data unavailable for this actor.</p>
        ) : (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {[["Lead", leadAwards], ["Supporting", supportingAwards]].map(([title, awards]) => (
              <div key={title} className="rounded-xl border border-line/60 bg-card/30 p-3.5 sm:p-4">
                <h4 className="mb-2 text-sm font-bold text-sky-300">{title}</h4>
                {awards.length === 0 ? <p className="text-xs sm:text-sm text-slate-500">No notable awards found.</p> : (
                  <ul className="space-y-2 text-xs sm:text-sm">
                    {awards.slice(0, 8).map((a) => (
                      <li key={`${a.label}-${a.role}`} className="flex items-start justify-between gap-3 border-b border-line/40 pb-2">
                        <span className="text-slate-200 leading-snug">{a.label}</span>
                        <span className="shrink-0 text-right text-slate-400 font-medium">
                          {a.won > 0 && `${a.won} won`}{a.won > 0 && a.nominated > 0 && ", "}{a.nominated > 0 && `${a.nominated} nom`}
                        </span>
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
            <h3 className="mt-7 sm:mt-8 text-base sm:text-lg font-bold text-white">Historical notes</h3>
            <div className="mt-2 space-y-2">
              {actor.curated_notes.map((note, index) => (
                <p key={index} className="rounded-xl border border-line/60 bg-card/30 p-3 text-xs sm:text-sm text-slate-300">
                  {note.text}
                  {note.source && <span className="mt-1 block text-xs text-slate-500">Source: {note.source}</span>}
                </p>
              ))}
            </div>
          </>
        )}

        <h3 className="mt-7 sm:mt-8 text-base sm:text-lg font-bold text-white">Critical excerpts</h3>
        {(actor.excerpts?.length || 0) === 0 ? <p className="mt-2 text-xs sm:text-sm text-slate-500">Not enough reviews mention this actor.</p> : (
          <div className="mt-3 space-y-3">
            {actor.excerpts.map((e, i) => (
              <blockquote key={i} className="border-l-2 border-sky-400 bg-card/20 py-1.5 pl-4 rounded-r-lg text-xs sm:text-sm italic text-slate-300">
                “{e.text}”<footer className="mt-1 text-xs not-italic text-slate-400">Review of {e.movie}</footer>
              </blockquote>
            ))}
          </div>
        )}

        <h3 className="mt-7 sm:mt-8 text-base sm:text-lg font-bold text-white">Top lead roles</h3>
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
          {(actor.leads || []).map((m) => (
            <li key={m.id}>
              <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-line/60 bg-card/40 px-3.5 py-2.5 text-left text-sm">
                <span className="truncate font-medium text-slate-200">{m.title}{m.year && <span className="text-slate-500 text-xs"> ({m.year})</span>}</span>
                <span className="shrink-0 rounded bg-sky-950/70 border border-sky-800/40 px-2 py-0.5 text-xs font-bold text-sky-400">{m.rating}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
