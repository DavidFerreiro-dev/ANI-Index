import ScoreBadge from "./ScoreBadge.jsx";

export default function ActorCard({ actor, onOpen, mode = "Actors" }) {
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
        <div className="absolute right-3 top-3"><ScoreBadge score={actor.score} size={56} /></div>
      </div>
      <div className="p-4">
        <h2 className="text-xl font-extrabold leading-tight">{actor.name}</h2>
        <p className="mt-3 text-sm text-slate-400">{projectTitle}</p>
        <ul className="mt-1 space-y-1">
          {projects.slice(0, 3).map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-2 text-sm">
              <span className="truncate text-left text-slate-200">{m.title}</span>
              <span className="shrink-0 text-slate-400">{m.rating}</span>
            </li>
          ))}
          {projects.length === 0 && <li className="text-sm text-slate-500">{mode === "Directors" ? "No directed films found" : "No lead roles found"}</li>}
        </ul>
      </div>
    </article>
  );
}
