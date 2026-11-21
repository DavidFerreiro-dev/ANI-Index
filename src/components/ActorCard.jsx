import ScoreBadge from "./ScoreBadge.jsx";

export default function ActorCard({ actor, onOpen, onMovie }) {
  return (
    <article onClick={() => onOpen(actor)} onKeyDown={(e) => e.key === "Enter" && onOpen(actor)} tabIndex={0} role="button"
             className="group cursor-pointer overflow-hidden rounded-2xl border border-line bg-card transition hover:border-slate-500">
      <div className="relative aspect-[2/3] bg-coal">
        {actor.profile ? (
          <img src={`https://image.tmdb.org/t/p/w500${actor.profile}`} alt={actor.name} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-slate-500">No photo</div>
        )}
        <div className="absolute right-3 top-3"><ScoreBadge score={actor.score} size={56} /></div>
      </div>
      <div className="p-4">
        <h2 className="text-xl font-extrabold leading-tight">{actor.name}</h2>
        <p className="mt-3 text-sm text-slate-400">Top lead projects</p>
        <ul className="mt-1 space-y-1">
          {actor.leads.slice(0, 3).map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-2 text-sm">
              <button onClick={(e) => { e.stopPropagation(); onMovie({ id: m.id, title: m.title }); }}
                      className="truncate text-left text-slate-200 hover:text-sky-300 hover:underline">{m.title}</button>
              <span className="shrink-0 text-slate-400">{m.rating}</span>
            </li>
          ))}
          {actor.leads.length === 0 && <li className="text-sm text-slate-500">No lead roles found</li>}
        </ul>
      </div>
    </article>
  );
}
