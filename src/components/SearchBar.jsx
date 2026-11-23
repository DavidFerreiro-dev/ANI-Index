import { useEffect, useRef, useState } from "react";
import { Search, Loader2 } from "lucide-react";

export default function SearchBar({ api, onPick, onError, mode = "Actors" }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef(null);

  useEffect(() => {
    if (q.trim().length < 2) { setItems([]); return; }
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const response = await fetch(`${api}/api/search?q=${encodeURIComponent(q)}&mode=${mode === "Directors" ? "directors" : "actors"}`);
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error("Search service unavailable. Run the app with Netlify Dev.");
        }
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.detail || "Search failed");
        }
        setItems(Array.isArray(data) ? data.filter((it) => it.type === "Actor" || it.type === "Director") : []);
        setOpen(true);
      } catch (error) {
        setItems([]);
        setOpen(false);
        onError?.(error.message);
      }
      setBusy(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q, api, mode]);

  useEffect(() => {
    const h = (e) => box.current && !box.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={box} className="relative z-50 mx-auto w-full max-w-2xl">
      <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={22} />
      <input value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => items.length && setOpen(true)}
             placeholder={mode === "Directors" ? "Search directors..." : "Search actors..."} aria-label={mode === "Directors" ? "Search directors" : "Search actors"}
             className="w-full rounded-full border border-line bg-card py-4 pl-14 pr-12 text-lg placeholder:text-slate-500 focus:border-sky-400 focus:outline-none" />
      {busy && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 animate-spin text-slate-400" size={20} />}
      {open && items.length > 0 && (
        <ul className="absolute z-[9999] mt-2 max-h-96 w-full overflow-auto rounded-2xl border border-line bg-card p-2 shadow-2xl">
          {items.map((it) => (
            <li key={it.type + it.id}>
              <button onClick={() => { setOpen(false); setQ(""); onPick(it); }}
                      className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-coal">
                {it.image ? <img src={`https://image.tmdb.org/t/p/w92${it.image}`} alt="" className="h-14 w-10 rounded object-cover" />
                           : <div className="h-14 w-10 rounded bg-coal" />}
                <span className="flex-1 truncate font-medium">{it.name}{it.year ? ` (${it.year})` : ""}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${it.type === "Actor" ? "bg-sky-500/15 text-sky-300" : "bg-amber-500/15 text-amber-300"}`}>{it.type}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
