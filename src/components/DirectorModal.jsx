import { X } from "lucide-react";
import ScoreBadge from "./ScoreBadge.jsx";

const PILLARS = [
  ["quality", "Filmography Quality & Consistency", 40],
  ["awards", "Awards & Festivals Prestige", 25],
  ["commercial", "Commercial Impact", 15],
  ["versatility", "Authorship & Versatility", 10],
  ["legacy", "Cultural Legacy", 10]
];

export default function DirectorModal({ director, onClose }) {
  const notable = director.notable_awards || director.awards?.awards || [];
  const directing = notable.filter((award) => award.role !== "Writing");
  const writing = notable.filter((award) => award.role === "Writing");

  return (
    <div className="fixed inset-0 z-40 flex items-center sm:items-start justify-center overflow-y-auto bg-black/80 p-2 sm:p-4 sm:py-8" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={director.name} onClick={(event) => event.stopPropagation()}
           className="relative my-auto sm:my-8 w-[95vw] sm:w-full max-h-[90vh] overflow-y-auto rounded-2xl sm:rounded-3xl border border-line bg-coal p-4 sm:p-8 max-w-4xl scroll-smooth shadow-2xl">
        <button onClick={onClose} aria-label="Close"
                className="sticky top-0 float-right -mr-1 -mt-1 sm:-mr-2 sm:-mt-2 z-20 rounded-full bg-coal/90 p-2 sm:p-2.5 backdrop-blur-md border border-line/70 text-slate-300 hover:text-white hover:bg-card transition shadow-md">
          <X size={20} />
        </button>

        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-start text-center sm:text-left">
          {director.profile ? (
            <img src={`https://image.tmdb.org/t/p/w500${director.profile}`} alt=""
                 className="h-52 w-36 sm:h-64 sm:w-44 shrink-0 rounded-2xl object-cover object-top shadow-lg border border-line/40" />
          ) : (
            <div className="grid h-52 w-36 sm:h-64 sm:w-44 shrink-0 place-items-center rounded-2xl border border-line/40 bg-card text-slate-500">No photo</div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{director.name}</h2>
            <div className="mt-3 flex flex-col sm:flex-row items-center sm:items-center gap-2 sm:gap-3 justify-center sm:justify-start">
              <ScoreBadge score={director.score} size={68} />
              <div className="flex flex-col items-center sm:items-start">
                <span className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-xs font-bold text-sky-300 tracking-wide uppercase">
                  ANI Index
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs sm:text-sm leading-relaxed text-slate-300">{director.summary || "No biography available."}</p>
          </div>
        </div>

        <h3 className="mt-7 sm:mt-8 text-base sm:text-lg font-bold text-white">Score breakdown</h3>
        <p className="mt-1 sm:mt-2 text-xs sm:text-sm text-slate-400 leading-relaxed">
          Based on {director.valid_work_count ?? 0} valid feature films, {director.written_movie_count ?? 0} written/co-written, and {director.award_count ?? 0} counted directing/writing awards
        </p>
        <div className="mt-3.5 space-y-3.5">
          {PILLARS.map(([key, label, weight]) => (
            <div key={key}>
              <div className="flex justify-between text-sm sm:text-base">
                <span className="font-semibold text-slate-200">{label} <span className="text-xs sm:text-sm font-normal text-slate-400">({weight}%)</span></span>
                <span className="font-extrabold text-white">{director.pillars?.[key] ?? 0}</span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-card">
                <div className="h-full rounded-full bg-sky-400 transition-all duration-500" style={{ width: `${director.pillars?.[key] ?? 0}%` }} />
              </div>
            </div>
          ))}
        </div>

        <h3 className="mt-7 sm:mt-8 text-base sm:text-lg font-bold text-white">Notable awards</h3>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {[["Directing & Film", directing], ["Writing", writing]].map(([title, awards]) => (
            <div key={title} className="rounded-xl border border-line/60 bg-card/30 p-3.5 sm:p-4">
              <h4 className="mb-2 text-sm font-bold text-sky-300">{title}</h4>
              {awards.length === 0
                ? <p className="text-xs sm:text-sm text-slate-500">No notable awards found.</p>
                : <ul className="space-y-2 text-xs sm:text-sm">{awards.slice(0, 8).map((award, index) => (
                    <li key={`${award.label}-${index}`} className="flex items-start justify-between gap-3 border-b border-line/40 pb-2">
                      <span className="text-slate-200 leading-snug">{award.label}</span>
                      <span className="shrink-0 text-right text-slate-400 font-medium">{award.won ? `${award.won} won` : `${award.nominated || 0} nom`}</span>
                    </li>
                  ))}</ul>}
            </div>
          ))}
        </div>

        <h3 className="mt-7 sm:mt-8 text-base sm:text-lg font-bold text-white">Top Directed Films</h3>
        <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-3">
          {(director.leads || []).map((movie) => (
            <li key={movie.id}>
              <div className="flex w-full items-center justify-between gap-3 rounded-xl border border-line/60 bg-card/40 px-3.5 py-2.5 text-left text-sm">
                <span className="truncate font-medium text-slate-200">{movie.title}{movie.year ? ` (${movie.year})` : ""}</span>
                <span className="shrink-0 rounded bg-sky-950/70 border border-sky-800/40 px-2 py-0.5 text-xs font-bold text-sky-400">{movie.rating}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
