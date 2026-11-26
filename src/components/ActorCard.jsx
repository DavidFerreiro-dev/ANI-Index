import ScoreBadge from "./ScoreBadge.jsx";

export default function ActorCard({ actor, onOpen, onOpenMovie, mode = "Actors", isDetailed = false }) {
  const projects = actor.leads || [];
  const projectTitle = mode === "Directors" ? "Top directed films" : "Top lead projects";
  return (
    <article onClick={() => onOpen(actor)} onKeyDown={(e) => e.key === "Enter" && onOpen(actor)} tabIndex={0} role="button"
             className="group cursor-pointer overflow-hidden rounded-2xl border border-line bg-card transition hover:border-slate-500">
      <div className="relative aspect-[2/3] bg-coal overflow-hidden">
        {actor.profile ? (
          <img src={`https://image.tmdb.org/t/p/w500${actor.profile}`} alt={actor.name} loading="lazy" className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center text-slate-500">No photo</div>
        )}
        <div className="absolute right-3 top-3"><ScoreBadge score={actor.score} size={56} isDetailed={isDetailed} /></div>
      </div>
      <div className="p-4">
        <h2 className="text-xl font-extrabold leading-tight">{actor.name}</h2>
        <p className="mt-3 text-sm text-slate-400">{projectTitle}</p>
        <ul className="mt-1 space-y-1">
          {projects.slice(0, 3).map((m) => (
            <li key={`${m.media_type || "movie"}-${m.id}`}>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenMovie?.(m.id, m.title, m.media_type || "movie");
                }}
                className="flex w-full items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left text-sm transition hover:bg-coal hover:text-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-400/70"
                title={`View ${m.title} cast and ratings`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate text-slate-200">{m.title}</span>
                  {m.media_type === "tv" && (
                    <span className="shrink-0 rounded bg-sky-500/15 border border-sky-500/30 px-1 py-0 text-[10px] font-bold text-sky-300">TV</span>
                  )}
                </span>
                <span className="shrink-0 text-slate-400">{m.rating}</span>
              </button>
            </li>
          ))}
          {projects.length === 0 && <li className="text-sm text-slate-500">{mode === "Directors" ? "No directed films found" : "No lead roles found"}</li>}
        </ul>
      </div>
    </article>
  );
}
